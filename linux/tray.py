#!/usr/bin/python3
"""Native Raspberry Pi panel indicator for the Octopus FoxESS server."""

import json
import fcntl
import os
import subprocess
import threading
import urllib.error
import urllib.request

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("AyatanaAppIndicator3", "0.1")
from gi.repository import AyatanaAppIndicator3, GLib, Gtk  # noqa: E402


LOCK_HANDLE = open(
    os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "octopus-foxess-tray.lock"),
    "w",
    encoding="utf-8",
)
try:
    fcntl.flock(LOCK_HANDLE, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(0)


PORT = 8787
try:
    with open("/etc/default/octopus-foxess", "r", encoding="utf-8") as defaults:
        for line in defaults:
            if line.startswith("OCTOPUS_PORT="):
                PORT = int(line.split("=", 1)[1].strip())
except (FileNotFoundError, ValueError):
    pass

BASE_URL = f"http://127.0.0.1:{PORT}"
ICON_ROOT = "/usr/share/icons/hicolor"
ICONS = {
    "green": "octopus-foxess-status-green",
    "amber": "octopus-foxess-status-amber",
    "red": "octopus-foxess-status-red",
}


def api_json(path, method="GET", payload=None, timeout=5):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        method=method,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status == 204:
            return {}
        return json.loads(response.read().decode("utf-8"))


def run_detached(command):
    subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def state_text(integration, good="Connected"):
    state = integration.get("state")
    if state == "ok":
        return f"✅ {good}"
    if state == "waiting":
        return "⚠️ Waiting for first successful request"
    if state == "not-configured":
        return "❌ Not configured"
    return f"❌ {integration.get('lastError') or 'Connection problem'}"


def live_status_text(live):
    policy = live.get("policy") or ("rest" if live.get("mode") == "rest" else "on-demand")
    connected = live.get("source") == "live-ws" and (
        live.get("connected") is True or live.get("state") in ("connected", "live")
    )
    if connected:
        return "✅ Live WebSocket connected" + (" · always" if policy == "always" else " · dynamic charge")
    if policy == "rest" or live.get("mode") == "rest":
        return "✅ Official REST selected"
    if live.get("state") == "standby" or live.get("reason") == "waiting-for-dynamic-schedule":
        return "✅ On-demand standby · official REST active"
    if live.get("state") == "connecting":
        return "⚠️ Live WebSocket connecting…"
    if live.get("reason") == "live-credentials-empty":
        return "⚠️ Official REST active · optional Live login is empty"
    detail = live.get("lastError") or live.get("reason") or "Live WS unavailable"
    return f"⚠️ Official REST fallback active · {detail}"


def live_status_severity(live):
    text = live_status_text(live)
    return "green" if text.startswith("✅") else "amber"


def run_in_background(work, on_success, on_error):
    def runner():
        try:
            result = work()
        except Exception as error:  # Network failures are reported in the GTK UI.
            GLib.idle_add(on_error, error)
        else:
            GLib.idle_add(on_success, result)

    threading.Thread(target=runner, daemon=True).start()


class ServerConfigurationWindow(Gtk.Window):
    def __init__(self, controller):
        super().__init__(title="Octopus FoxESS Server Configuration")
        self.controller = controller
        self.config_loaded = False
        self.config_refresh_in_progress = False
        self.operation_in_progress = False
        self.set_default_size(980, 620)
        self.set_border_width(10)
        self.connect("delete-event", self.hide_on_close)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self.add(root)

        heading = Gtk.Label()
        heading.set_markup("<span size='x-large' weight='bold'>Octopus FoxESS Server</span>")
        heading.set_xalign(0)
        root.pack_start(heading, False, False, 0)

        intro = Gtk.Label(
            label="Private Raspberry Pi configuration. The automation worker keeps running after this window closes."
        )
        intro.set_xalign(0)
        intro.set_line_wrap(True)
        root.pack_start(intro, False, False, 0)

        columns = Gtk.Grid(column_spacing=12, row_spacing=0)
        columns.set_column_homogeneous(True)
        columns.set_hexpand(True)
        columns.set_vexpand(True)
        root.pack_start(columns, True, True, 0)

        left_column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        right_column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        columns.attach(left_column, 0, 0, 1, 1)
        columns.attach(right_column, 1, 0, 1, 1)

        access_frame = Gtk.Frame(label="Dashboard access")
        left_column.pack_start(access_frame, False, False, 0)
        access_grid = Gtk.Grid(column_spacing=10, row_spacing=7, margin=10)
        access_frame.add(access_grid)

        self.address = Gtk.Entry()
        self.address.set_editable(False)
        self.address.set_hexpand(True)
        access_grid.attach(Gtk.Label(label="Listen address", xalign=0), 0, 0, 1, 1)
        access_grid.attach(self.address, 1, 0, 2, 1)

        self.access_required = Gtk.CheckButton(
            label="Require Dashboard Access Code"
        )
        self.access_required.set_active(True)
        self.access_required.connect("toggled", self.update_access_sensitivity)
        access_grid.attach(self.access_required, 0, 1, 3, 1)

        self.access_code = Gtk.Entry()
        self.access_code.set_visibility(False)
        self.access_code.set_input_purpose(Gtk.InputPurpose.PASSWORD)
        self.access_code.set_hexpand(True)
        access_grid.attach(Gtk.Label(label="LAN access code", xalign=0), 0, 2, 1, 1)
        access_grid.attach(self.access_code, 1, 2, 1, 1)

        show_code = Gtk.CheckButton(label="Show")
        show_code.connect("toggled", lambda button: self.access_code.set_visibility(button.get_active()))
        access_grid.attach(show_code, 2, 2, 1, 1)

        warning = Gtk.Label(
            label="Without protection, anyone on this LAN can view and control the dashboard."
        )
        warning.set_xalign(0)
        warning.set_line_wrap(True)
        access_grid.attach(warning, 0, 3, 3, 1)

        integration_frame = Gtk.Frame(label="Integration settings")
        right_column.pack_start(integration_frame, False, False, 0)
        integration_grid = Gtk.Grid(column_spacing=10, row_spacing=7, margin=10)
        integration_grid.set_column_homogeneous(False)
        integration_frame.add(integration_grid)

        self.fields = {}

        def add_entry(row, key, label, secret=False):
            entry = Gtk.Entry()
            entry.set_hexpand(True)
            entry.set_visibility(not secret)
            if secret:
                entry.set_input_purpose(Gtk.InputPurpose.PASSWORD)
            integration_grid.attach(Gtk.Label(label=label, xalign=0), 0, row, 1, 1)
            integration_grid.attach(entry, 1, row, 2, 1)
            self.fields[key] = entry

        add_entry(0, "acc", "Octopus account", True)
        add_entry(1, "api", "Octopus API key", True)
        add_entry(2, "foxSN", "FoxESS serial number")
        add_entry(3, "foxToken", "FoxESS API token", True)

        self.live_enabled = Gtk.CheckButton(label="Enable FoxESS Live WS telemetry")
        self.live_enabled.connect("toggled", self.update_live_sensitivity)
        integration_grid.attach(self.live_enabled, 0, 4, 3, 1)

        self.live_revealer = Gtk.Revealer()
        self.live_revealer.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        live_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        live_grid = Gtk.Grid(column_spacing=10, row_spacing=7)
        live_box.pack_start(live_grid, False, False, 0)

        def add_live_entry(row, key, label, secret=False):
            entry = Gtk.Entry()
            entry.set_hexpand(True)
            entry.set_visibility(not secret)
            if secret:
                entry.set_input_purpose(Gtk.InputPurpose.PASSWORD)
            live_grid.attach(Gtk.Label(label=label, xalign=0), 0, row, 1, 1)
            live_grid.attach(entry, 1, row, 1, 1)
            self.fields[key] = entry

        add_live_entry(0, "foxWebUsername", "FoxESS web-login email")
        add_live_entry(1, "foxWebPassword", "FoxESS web-login password", True)

        live_note = Gtk.Label(
            label="Live WS is read-only and may sign the FoxESS app out during a test. "
            "Choose on-demand, always, or REST-only later from the dashboard menu."
        )
        live_note.set_xalign(0)
        live_note.set_line_wrap(True)
        live_box.pack_start(live_note, False, False, 0)
        self.live_revealer.add(live_box)
        integration_grid.attach(self.live_revealer, 0, 5, 3, 1)

        self.show_secrets = Gtk.CheckButton(label="Show account, keys, tokens, and passwords")
        self.show_secrets.connect("toggled", self.update_secret_visibility)
        integration_grid.attach(self.show_secrets, 0, 6, 3, 1)

        status_frame = Gtk.Frame(label="Connection status")
        left_column.pack_start(status_frame, False, False, 0)
        status_grid = Gtk.Grid(column_spacing=10, row_spacing=7, margin=10)
        status_frame.add(status_grid)
        self.status_values = {}
        for row, (key, label) in enumerate(
            (
                ("server", "Server"),
                ("octopus", "Octopus API"),
                ("foxRest", "FoxESS REST"),
                ("foxLive", "FoxESS Live WS"),
            )
        ):
            status_grid.attach(Gtk.Label(label=label, xalign=0), 0, row, 1, 1)
            value = Gtk.Label(label="Checking…", xalign=0)
            value.set_line_wrap(True)
            value.set_hexpand(True)
            status_grid.attach(value, 1, row, 1, 1)
            self.status_values[key] = value

        self.message = Gtk.Label(xalign=0)
        self.message.set_line_wrap(True)
        root.pack_start(self.message, False, False, 0)

        buttons = Gtk.ButtonBox(orientation=Gtk.Orientation.HORIZONTAL)
        buttons.set_layout(Gtk.ButtonBoxStyle.END)
        buttons.set_spacing(8)
        root.pack_end(buttons, False, False, 0)

        dashboard = Gtk.Button(label="Open Dashboard Client")
        dashboard.connect("clicked", lambda _button: run_detached(["/usr/local/bin/octopus-foxess-dashboard"]))
        buttons.add(dashboard)

        self.refresh_button = Gtk.Button(label="Refresh")
        self.refresh_button.connect("clicked", self.refresh_all)
        buttons.add(self.refresh_button)

        self.live_test_button = Gtk.Button(label="Save & Test Live WS")
        self.live_test_button.connect("clicked", self.test_live_connection)
        buttons.add(self.live_test_button)

        self.save_button = Gtk.Button(label="Save Configuration")
        self.save_button.get_style_context().add_class("suggested-action")
        self.save_button.connect("clicked", self.save_configuration)
        buttons.add(self.save_button)

    def hide_on_close(self, *_args):
        self.hide()
        return True

    def show_window(self):
        self.show_all()
        self.update_live_sensitivity()
        self.present()
        self.refresh_all()

    def update_access_sensitivity(self, *_args):
        self.access_code.set_sensitive(self.access_required.get_active())

    def update_live_sensitivity(self, *_args):
        enabled = self.live_enabled.get_active()
        self.live_revealer.set_reveal_child(enabled)
        self.fields["foxWebUsername"].set_sensitive(enabled)
        self.fields["foxWebPassword"].set_sensitive(enabled)
        if hasattr(self, "live_test_button"):
            self.live_test_button.set_sensitive(enabled and not self.operation_in_progress)

    def update_secret_visibility(self, button):
        visible = button.get_active()
        for key in ("acc", "api", "foxToken", "foxWebPassword"):
            self.fields[key].set_visibility(visible)

    def refresh_all(self, *_args):
        self.load_configuration()
        self.controller.refresh()

    def load_configuration(self):
        if self.config_refresh_in_progress or self.operation_in_progress:
            return
        self.config_refresh_in_progress = True
        self.refresh_button.set_sensitive(False)
        self.save_button.set_sensitive(False)
        self.live_test_button.set_sensitive(False)
        self.message.set_text("Loading server configuration…")
        run_in_background(
            lambda: api_json("/api/native-config"),
            self.configuration_loaded,
            self.configuration_load_failed,
        )

    def configuration_loaded(self, config):
        credentials = config.get("credentials") or {}
        self.access_required.set_active(config.get("accessRequired") is not False)
        self.access_code.set_text(config.get("accessKey", ""))
        for key, entry in self.fields.items():
            entry.set_text(str(credentials.get(key, "")))
        self.live_enabled.set_active(
            config.get("liveWsEnabled", credentials.get("foxLiveMode") != "rest")
        )
        self.config_loaded = True
        self.config_refresh_in_progress = False
        self.refresh_button.set_sensitive(True)
        self.save_button.set_sensitive(True)
        self.update_access_sensitivity()
        self.update_live_sensitivity()
        self.message.set_text("")
        return False

    def configuration_load_failed(self, error):
        self.config_refresh_in_progress = False
        self.refresh_button.set_sensitive(True)
        self.save_button.set_sensitive(True)
        self.update_live_sensitivity()
        self.message.set_markup(
            f"<span foreground='#b91c1c'>Could not load configuration: "
            f"{GLib.markup_escape_text(str(error))}</span>"
        )
        return False

    def update_status(self, status):
        urls = status.get("lanUrls") or []
        self.address.set_text(urls[0] if urls else f"http://raspberrypi.local:{PORT}")
        self.status_values["server"].set_text(f"✅ Running · v{status.get('version', 'unknown')}")
        self.status_values["octopus"].set_text(state_text(status.get("octopus", {})))
        self.status_values["foxRest"].set_text(state_text(status.get("foxRest", {})))

        self.status_values["foxLive"].set_text(live_status_text(status.get("foxLive", {})))

    def show_offline(self, message):
        self.address.set_text(f"http://raspberrypi.local:{PORT}")
        self.status_values["server"].set_text("❌ Server is not responding")
        for key in ("octopus", "foxRest", "foxLive"):
            self.status_values[key].set_text("❌ Unavailable while server is offline")
        self.message.set_text(message)

    def configuration_payload(self):
        return {
            "accessRequired": self.access_required.get_active(),
            "accessKey": self.access_code.get_text().strip(),
            "liveWsEnabled": self.live_enabled.get_active(),
            "credentials": {
                "acc": self.fields["acc"].get_text().strip(),
                "api": self.fields["api"].get_text().strip(),
                "foxSN": self.fields["foxSN"].get_text().strip(),
                "foxToken": self.fields["foxToken"].get_text().strip(),
                "foxLiveMode": "live-ws" if self.live_enabled.get_active() else "rest",
                "foxWebUsername": self.fields["foxWebUsername"].get_text().strip(),
                "foxWebPassword": self.fields["foxWebPassword"].get_text(),
                "gasUrl": "/api/foxess",
            },
        }

    def set_operation_busy(self, busy):
        self.operation_in_progress = busy
        self.save_button.set_sensitive(not busy)
        self.refresh_button.set_sensitive(not busy and not self.config_refresh_in_progress)
        self.update_live_sensitivity()

    def save_configuration(self, _button=None, quiet=False, after_save=None):
        access_code = self.access_code.get_text().strip()
        if self.access_required.get_active() and not 8 <= len(access_code) <= 64:
            self.message.set_markup("<span foreground='#b91c1c'>Use 8–64 printable characters.</span>")
            return False
        if self.operation_in_progress:
            return False
        payload = self.configuration_payload()
        self.set_operation_busy(True)
        self.message.set_text("Saving server configuration…")

        def saved(_result):
            if not quiet:
                self.message.set_markup(
                    "<span foreground='#047857'>Server configuration saved. "
                    "The background worker will reload it automatically.</span>"
                )
            self.controller.refresh()
            if after_save:
                after_save()
            else:
                self.set_operation_busy(False)
            return False

        def failed(error):
            self.set_operation_busy(False)
            self.message.set_markup(
                f"<span foreground='#b91c1c'>Could not save: {GLib.markup_escape_text(str(error))}</span>"
            )
            return False

        run_in_background(
            lambda: api_json("/api/native-config", "PUT", payload),
            saved,
            failed,
        )
        return True

    def test_live_connection(self, _button):
        if not self.live_enabled.get_active():
            self.message.set_markup(
                "<span foreground='#b45309'>Enable Live WS and enter the FoxESS web-login credentials first.</span>"
            )
            return
        self.save_configuration(
            quiet=True,
            after_save=self.start_live_connection_test,
        )

    def start_live_connection_test(self):
        self.message.set_text(
            "Testing one fresh FoxESS Live WS frame now… "
            "The window remains usable while the check runs."
        )

        def tested(status):
            self.set_operation_busy(False)
            if status.get("source") == "live-ws" and status.get("state") == "live":
                if status.get("policy") == "on-demand":
                    message = (
                        "Live WS test successful. The temporary test connection is closed; "
                        "official REST remains active until a dynamic charge starts."
                    )
                else:
                    message = "Live WS test successful. The dashboard's selected telemetry policy remains active."
                self.message.set_markup(f"<span foreground='#047857'>{message}</span>")
            else:
                detail = status.get("lastError") or status.get("reason") or "connection unavailable"
                self.message.set_markup(
                    f"<span foreground='#b45309'>Live WS unavailable; official REST fallback is active. "
                    f"{GLib.markup_escape_text(str(detail))}</span>"
                )
            self.controller.refresh()
            return False

        def test_failed(error):
            self.set_operation_busy(False)
            self.message.set_markup(
                f"<span foreground='#b91c1c'>Live WS test failed; REST fallback remains active. "
                f"{GLib.markup_escape_text(str(error))}</span>"
            )
            return False

        run_in_background(
            lambda: api_json("/api/foxess/live/test", "POST", {}, timeout=70),
            tested,
            test_failed,
        )


class TrayController:
    def __init__(self):
        self.refresh_in_progress = False
        self.indicator = AyatanaAppIndicator3.Indicator.new(
            "octopus-foxess-server",
            ICONS["amber"],
            AyatanaAppIndicator3.IndicatorCategory.SYSTEM_SERVICES,
        )
        self.indicator.set_icon_theme_path(ICON_ROOT)
        self.indicator.set_status(AyatanaAppIndicator3.IndicatorStatus.ACTIVE)
        self.indicator.set_title("Octopus FoxESS Server")

        self.menu = Gtk.Menu()
        self.summary_item = self.add_status_item("Server: checking…")
        self.octopus_item = self.add_status_item("Octopus API: checking…")
        self.fox_rest_item = self.add_status_item("FoxESS REST: checking…")
        self.fox_live_item = self.add_status_item("FoxESS Live WS: checking…")
        self.menu.append(Gtk.SeparatorMenuItem())

        configure = Gtk.MenuItem(label="Server Configuration…")
        configure.connect("activate", lambda _item: self.window.show_window())
        self.menu.append(configure)

        dashboard = Gtk.MenuItem(label="Open Dashboard Client")
        dashboard.connect("activate", lambda _item: run_detached(["/usr/local/bin/octopus-foxess-dashboard"]))
        self.menu.append(dashboard)

        self.menu.append(Gtk.SeparatorMenuItem())
        quit_item = Gtk.MenuItem(label="Quit Status Icon")
        quit_item.connect("activate", lambda _item: Gtk.main_quit())
        self.menu.append(quit_item)

        self.menu.show_all()
        self.indicator.set_menu(self.menu)
        self.window = ServerConfigurationWindow(self)
        GLib.timeout_add_seconds(10, self.refresh)
        self.refresh()

    def add_status_item(self, text):
        item = Gtk.MenuItem(label=text)
        item.set_sensitive(False)
        self.menu.append(item)
        return item

    def refresh(self):
        if self.refresh_in_progress:
            return True
        self.refresh_in_progress = True
        run_in_background(
            lambda: api_json("/api/service-status"),
            self.apply_status,
            self.apply_offline,
        )
        return True

    def apply_status(self, status):
        self.refresh_in_progress = False
        octopus = status.get("octopus", {})
        fox_rest = status.get("foxRest", {})
        fox_live = status.get("foxLive", {})
        definite_problem = octopus.get("state") in ("error", "not-configured") or fox_rest.get("state") in (
            "error",
            "not-configured",
        )
        waiting = octopus.get("state") == "waiting" or fox_rest.get("state") == "waiting"
        live_warning = live_status_severity(fox_live) == "amber"
        color = "red" if definite_problem else ("amber" if waiting or live_warning else "green")
        self.indicator.set_icon_full(ICONS[color], f"Octopus FoxESS server {color}")
        self.summary_item.set_label(f"Server: ✅ running · v{status.get('version', 'unknown')}")
        self.octopus_item.set_label(f"Octopus API: {state_text(octopus)}")
        self.fox_rest_item.set_label(f"FoxESS REST: {state_text(fox_rest)}")
        self.fox_live_item.set_label(f"FoxESS Live WS: {live_status_text(fox_live)}")
        self.window.update_status(status)
        return False

    def apply_offline(self, error):
        self.refresh_in_progress = False
        self.indicator.set_icon_full(ICONS["red"], "Octopus FoxESS server offline")
        self.summary_item.set_label("Server: ❌ not responding")
        self.octopus_item.set_label("Octopus API: ❌ unavailable")
        self.fox_rest_item.set_label("FoxESS REST: ❌ unavailable")
        self.fox_live_item.set_label("FoxESS Live WS: ❌ unavailable")
        self.window.show_offline(str(error))
        return False


if __name__ == "__main__":
    TrayController()
    Gtk.main()
