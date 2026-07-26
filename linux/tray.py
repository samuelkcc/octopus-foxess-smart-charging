#!/usr/bin/python3
"""Native Raspberry Pi panel indicator for the Octopus FoxESS server."""

import json
import fcntl
import os
import subprocess
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


class ServerConfigurationWindow(Gtk.Window):
    def __init__(self, controller):
        super().__init__(title="Octopus FoxESS Server Configuration")
        self.controller = controller
        self.config_loaded = False
        self.set_default_size(680, 760)
        self.set_border_width(12)
        self.connect("delete-event", self.hide_on_close)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.add(root)

        scroller = Gtk.ScrolledWindow()
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        root.pack_start(scroller, True, True, 0)
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        content.set_border_width(8)
        scroller.add(content)

        heading = Gtk.Label()
        heading.set_markup("<span size='x-large' weight='bold'>Octopus FoxESS Server</span>")
        heading.set_xalign(0)
        content.pack_start(heading, False, False, 0)

        intro = Gtk.Label(
            label="This is the private Raspberry Pi configuration screen. "
            "The background worker keeps running when this window and every browser are closed."
        )
        intro.set_xalign(0)
        intro.set_line_wrap(True)
        content.pack_start(intro, False, False, 0)

        grid = Gtk.Grid(column_spacing=14, row_spacing=10)
        grid.set_column_homogeneous(False)
        content.pack_start(grid, False, False, 0)

        self.address = Gtk.Entry()
        self.address.set_editable(False)
        self.address.set_hexpand(True)
        grid.attach(Gtk.Label(label="Listen address", xalign=0), 0, 0, 1, 1)
        grid.attach(self.address, 1, 0, 2, 1)

        self.access_required = Gtk.CheckButton(
            label="Require an access code from Mobile / LAN dashboard clients"
        )
        self.access_required.set_active(True)
        self.access_required.connect("toggled", self.update_access_sensitivity)
        grid.attach(self.access_required, 0, 1, 3, 1)

        self.access_code = Gtk.Entry()
        self.access_code.set_visibility(False)
        self.access_code.set_input_purpose(Gtk.InputPurpose.PASSWORD)
        self.access_code.set_hexpand(True)
        grid.attach(Gtk.Label(label="LAN access code", xalign=0), 0, 2, 1, 1)
        grid.attach(self.access_code, 1, 2, 1, 1)

        show_code = Gtk.CheckButton(label="Show")
        show_code.connect("toggled", lambda button: self.access_code.set_visibility(button.get_active()))
        grid.attach(show_code, 2, 2, 1, 1)

        warning = Gtk.Label(
            label="If access-code protection is off, anyone on this local network can view the "
            "dashboard and change charging schedules."
        )
        warning.set_xalign(0)
        warning.set_line_wrap(True)
        content.pack_start(warning, False, False, 0)

        integration_frame = Gtk.Frame(label="Integration settings")
        content.pack_start(integration_frame, False, False, 0)
        integration_grid = Gtk.Grid(column_spacing=14, row_spacing=9, margin=12)
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

        integration_grid.attach(Gtk.Label(label="Telemetry source", xalign=0), 0, 4, 1, 1)
        self.live_mode = Gtk.ComboBoxText()
        self.live_mode.append("live-ws", "Live WebSocket (REST fallback)")
        self.live_mode.append("rest", "Official REST API only")
        self.live_mode.set_active_id("live-ws")
        self.live_mode.connect("changed", self.update_live_sensitivity)
        integration_grid.attach(self.live_mode, 1, 4, 2, 1)

        add_entry(5, "foxWebUsername", "FoxESS web-login email")
        add_entry(6, "foxWebPassword", "FoxESS web-login password", True)

        self.show_secrets = Gtk.CheckButton(label="Show account, keys, tokens, and passwords")
        self.show_secrets.connect("toggled", self.update_secret_visibility)
        integration_grid.attach(self.show_secrets, 1, 7, 2, 1)

        live_note = Gtk.Label(
            label="Live WS is read-only and undocumented. All commands continue through official REST."
        )
        live_note.set_xalign(0)
        live_note.set_line_wrap(True)
        integration_grid.attach(live_note, 0, 8, 3, 1)

        status_frame = Gtk.Frame(label="Connection status")
        content.pack_start(status_frame, False, False, 0)
        status_grid = Gtk.Grid(column_spacing=14, row_spacing=11, margin=12)
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
        content.pack_start(self.message, False, False, 0)

        buttons = Gtk.ButtonBox(orientation=Gtk.Orientation.HORIZONTAL)
        buttons.set_layout(Gtk.ButtonBoxStyle.END)
        buttons.set_spacing(8)
        root.pack_end(buttons, False, False, 0)

        dashboard = Gtk.Button(label="Open Dashboard Client")
        dashboard.connect("clicked", lambda _button: run_detached(["/usr/local/bin/octopus-foxess-dashboard"]))
        buttons.add(dashboard)

        refresh = Gtk.Button(label="Refresh")
        refresh.connect("clicked", self.refresh_all)
        buttons.add(refresh)

        live_test = Gtk.Button(label="Save & Test Live WS")
        live_test.connect("clicked", self.test_live_connection)
        buttons.add(live_test)

        save = Gtk.Button(label="Save Configuration")
        save.get_style_context().add_class("suggested-action")
        save.connect("clicked", self.save_configuration)
        buttons.add(save)

    def hide_on_close(self, *_args):
        self.hide()
        return True

    def show_window(self):
        self.show_all()
        self.present()
        self.refresh_all()

    def update_access_sensitivity(self, *_args):
        self.access_code.set_sensitive(self.access_required.get_active())

    def update_live_sensitivity(self, *_args):
        enabled = self.live_mode.get_active_id() != "rest"
        self.fields["foxWebUsername"].set_sensitive(enabled)
        self.fields["foxWebPassword"].set_sensitive(enabled)

    def update_secret_visibility(self, button):
        visible = button.get_active()
        for key in ("acc", "api", "foxToken", "foxWebPassword"):
            self.fields[key].set_visibility(visible)

    def refresh_all(self, *_args):
        self.load_configuration()
        self.controller.refresh()

    def load_configuration(self):
        try:
            config = api_json("/api/native-config")
            credentials = config.get("credentials") or {}
            self.access_required.set_active(config.get("accessRequired") is not False)
            self.access_code.set_text(config.get("accessKey", ""))
            for key, entry in self.fields.items():
                entry.set_text(str(credentials.get(key, "")))
            self.live_mode.set_active_id(
                "rest" if credentials.get("foxLiveMode") == "rest" else "live-ws"
            )
            self.config_loaded = True
            self.update_access_sensitivity()
            self.update_live_sensitivity()
            self.message.set_text("")
        except (OSError, ValueError, urllib.error.URLError) as error:
            self.message.set_markup(
                f"<span foreground='#b91c1c'>Could not load configuration: "
                f"{GLib.markup_escape_text(str(error))}</span>"
            )

    def update_status(self, status):
        urls = status.get("lanUrls") or []
        self.address.set_text(urls[0] if urls else f"http://raspberrypi.local:{PORT}")
        self.status_values["server"].set_text(f"✅ Running · v{status.get('version', 'unknown')}")
        self.status_values["octopus"].set_text(state_text(status.get("octopus", {})))
        self.status_values["foxRest"].set_text(state_text(status.get("foxRest", {})))

        live = status.get("foxLive", {})
        if live.get("source") == "live-ws" and (
            live.get("connected") is True or live.get("state") in ("connected", "live")
        ):
            live_text = "✅ Live WebSocket connected"
        elif live.get("mode") == "rest":
            live_text = "✅ Official REST selected"
        elif live.get("reason") == "live-credentials-empty":
            live_text = "⚠️ REST fallback · optional Live login is empty"
        else:
            live_text = f"❌ REST fallback · {live.get('lastError') or live.get('reason') or 'Live WS problem'}"
        self.status_values["foxLive"].set_text(live_text)

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
            "credentials": {
                "acc": self.fields["acc"].get_text().strip(),
                "api": self.fields["api"].get_text().strip(),
                "foxSN": self.fields["foxSN"].get_text().strip(),
                "foxToken": self.fields["foxToken"].get_text().strip(),
                "foxLiveMode": self.live_mode.get_active_id() or "live-ws",
                "foxWebUsername": self.fields["foxWebUsername"].get_text().strip(),
                "foxWebPassword": self.fields["foxWebPassword"].get_text(),
                "gasUrl": "/api/foxess",
            },
        }

    def save_configuration(self, _button=None, quiet=False):
        access_code = self.access_code.get_text().strip()
        if self.access_required.get_active() and not 8 <= len(access_code) <= 64:
            self.message.set_markup("<span foreground='#b91c1c'>Use 8–64 printable characters.</span>")
            return False
        try:
            api_json("/api/native-config", "PUT", self.configuration_payload())
            if not quiet:
                self.message.set_markup(
                    "<span foreground='#047857'>Server configuration saved. "
                    "The background worker will reload it automatically.</span>"
                )
            self.controller.refresh()
            return True
        except (OSError, ValueError, urllib.error.URLError) as error:
            self.message.set_markup(
                f"<span foreground='#b91c1c'>Could not save: {GLib.markup_escape_text(str(error))}</span>"
            )
            return False

    def test_live_connection(self, _button):
        if not self.save_configuration(quiet=True):
            return
        if self.live_mode.get_active_id() == "rest":
            self.message.set_markup(
                "<span foreground='#047857'>Configuration saved. Official REST is selected, "
                "so no Live WS test is needed.</span>"
            )
            return
        self.message.set_text("Waiting for a fresh FoxESS Live WS telemetry frame…")
        while Gtk.events_pending():
            Gtk.main_iteration()
        try:
            status = api_json("/api/foxess/live/test", "POST", {}, timeout=35)
            if status.get("source") == "live-ws" and status.get("state") == "live":
                self.message.set_markup(
                    "<span foreground='#047857'>Live WS test successful and live updates are active.</span>"
                )
            else:
                detail = status.get("lastError") or status.get("reason") or "connection unavailable"
                self.message.set_markup(
                    f"<span foreground='#b45309'>Live WS unavailable; official REST fallback is active. "
                    f"{GLib.markup_escape_text(str(detail))}</span>"
                )
            self.controller.refresh()
        except (OSError, ValueError, urllib.error.URLError) as error:
            self.message.set_markup(
                f"<span foreground='#b91c1c'>Live WS test failed; REST fallback remains active. "
                f"{GLib.markup_escape_text(str(error))}</span>"
            )


class TrayController:
    def __init__(self):
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
        try:
            status = api_json("/api/service-status")
            octopus = status.get("octopus", {})
            fox_rest = status.get("foxRest", {})
            fox_live = status.get("foxLive", {})
            definite_problem = octopus.get("state") in ("error", "not-configured") or fox_rest.get("state") in (
                "error",
                "not-configured",
            )
            waiting = octopus.get("state") == "waiting" or fox_rest.get("state") == "waiting"
            live_problem = (
                fox_live.get("mode") == "live-ws"
                and fox_live.get("source") != "live-ws"
                and fox_live.get("reason") != "live-credentials-empty"
            )
            color = "red" if definite_problem or live_problem else ("amber" if waiting else "green")
            self.indicator.set_icon_full(ICONS[color], f"Octopus FoxESS server {color}")
            self.summary_item.set_label(f"Server: ✅ running · v{status.get('version', 'unknown')}")
            self.octopus_item.set_label(f"Octopus API: {state_text(octopus)}")
            self.fox_rest_item.set_label(f"FoxESS REST: {state_text(fox_rest)}")
            if fox_live.get("source") == "live-ws":
                live_label = "✅ connected"
            elif fox_live.get("mode") == "rest":
                live_label = "✅ REST selected"
            elif fox_live.get("reason") == "live-credentials-empty":
                live_label = "⚠️ REST fallback (login empty)"
            else:
                live_label = "❌ REST fallback (Live problem)"
            self.fox_live_item.set_label(f"FoxESS Live WS: {live_label}")
            self.window.update_status(status)
        except (OSError, ValueError, urllib.error.URLError) as error:
            self.indicator.set_icon_full(ICONS["red"], "Octopus FoxESS server offline")
            self.summary_item.set_label("Server: ❌ not responding")
            self.octopus_item.set_label("Octopus API: ❌ unavailable")
            self.fox_rest_item.set_label("FoxESS REST: ❌ unavailable")
            self.fox_live_item.set_label("FoxESS Live WS: ❌ unavailable")
            self.window.show_offline(str(error))
        return True


if __name__ == "__main__":
    TrayController()
    Gtk.main()
