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


def api_json(path, method="GET", payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        method=method,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=3) as response:
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
        self.access_loaded = False
        self.set_default_size(520, 430)
        self.set_border_width(18)
        self.connect("delete-event", self.hide_on_close)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14)
        self.add(root)

        heading = Gtk.Label()
        heading.set_markup("<span size='x-large' weight='bold'>Octopus FoxESS Server</span>")
        heading.set_xalign(0)
        root.pack_start(heading, False, False, 0)

        intro = Gtk.Label(
            label="The server and automation worker run in the background. "
            "Use the address below from any device on the same local network."
        )
        intro.set_xalign(0)
        intro.set_line_wrap(True)
        root.pack_start(intro, False, False, 0)

        grid = Gtk.Grid(column_spacing=14, row_spacing=10)
        grid.set_column_homogeneous(False)
        root.pack_start(grid, False, False, 0)

        self.address = Gtk.Entry()
        self.address.set_editable(False)
        self.address.set_hexpand(True)
        grid.attach(Gtk.Label(label="Listen address", xalign=0), 0, 0, 1, 1)
        grid.attach(self.address, 1, 0, 2, 1)

        self.access_code = Gtk.Entry()
        self.access_code.set_visibility(False)
        self.access_code.set_input_purpose(Gtk.InputPurpose.PASSWORD)
        self.access_code.set_hexpand(True)
        grid.attach(Gtk.Label(label="LAN access code", xalign=0), 0, 1, 1, 1)
        grid.attach(self.access_code, 1, 1, 1, 1)

        show_code = Gtk.CheckButton(label="Show")
        show_code.connect("toggled", lambda button: self.access_code.set_visibility(button.get_active()))
        grid.attach(show_code, 2, 1, 1, 1)

        status_frame = Gtk.Frame(label="Connection status")
        root.pack_start(status_frame, True, True, 0)
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
        root.pack_start(self.message, False, False, 0)

        buttons = Gtk.ButtonBox(orientation=Gtk.Orientation.HORIZONTAL)
        buttons.set_layout(Gtk.ButtonBoxStyle.END)
        buttons.set_spacing(8)
        root.pack_end(buttons, False, False, 0)

        advanced = Gtk.Button(label="Integration Settings…")
        advanced.connect("clicked", lambda _button: run_detached(["/usr/local/bin/octopus-foxess-settings"]))
        buttons.add(advanced)

        dashboard = Gtk.Button(label="Open Dashboard Client")
        dashboard.connect("clicked", lambda _button: run_detached(["/usr/local/bin/octopus-foxess-dashboard"]))
        buttons.add(dashboard)

        refresh = Gtk.Button(label="Refresh")
        refresh.connect("clicked", lambda _button: self.controller.refresh())
        buttons.add(refresh)

        save = Gtk.Button(label="Save Access Code")
        save.get_style_context().add_class("suggested-action")
        save.connect("clicked", self.save_access_code)
        buttons.add(save)

    def hide_on_close(self, *_args):
        self.hide()
        return True

    def show_window(self):
        self.show_all()
        self.present()
        self.controller.refresh()

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

        if not self.access_loaded:
            try:
                key = api_json("/api/access-key").get("accessKey", "")
                self.access_code.set_text(key)
                self.access_loaded = True
            except (OSError, ValueError, urllib.error.URLError):
                pass

    def show_offline(self, message):
        self.address.set_text(f"http://raspberrypi.local:{PORT}")
        self.status_values["server"].set_text("❌ Server is not responding")
        for key in ("octopus", "foxRest", "foxLive"):
            self.status_values[key].set_text("❌ Unavailable while server is offline")
        self.message.set_text(message)

    def save_access_code(self, _button):
        access_code = self.access_code.get_text().strip()
        if not 8 <= len(access_code) <= 64:
            self.message.set_markup("<span foreground='#b91c1c'>Use 8–64 printable characters.</span>")
            return
        try:
            api_json("/api/access-key", "PUT", {"accessKey": access_code})
            self.message.set_markup("<span foreground='#047857'>LAN access code saved.</span>")
        except (OSError, ValueError, urllib.error.URLError) as error:
            self.message.set_markup(
                f"<span foreground='#b91c1c'>Could not save: {GLib.markup_escape_text(str(error))}</span>"
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

        advanced = Gtk.MenuItem(label="Integration Settings…")
        advanced.connect("activate", lambda _item: run_detached(["/usr/local/bin/octopus-foxess-settings"]))
        self.menu.append(advanced)

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
