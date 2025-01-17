import Gio from "gi://Gio";
import GObject from "gi://GObject";

import * as DBus from "./dbus.js";
import { Pihole as SingleInstance } from "./pihole.js";
import { MPihole as MultiInstance } from "./mpihole.js";

export const PiholeIndicator = GObject.registerClass(
  {
    GTypeName: "PiholeIndicator",
  },
  class PiholeIndicator extends GObject.Object {
    constructor(me, settings) {
      super();

      this._me = me;
      this._settings = settings;
      this._network_monitor = Gio.NetworkMonitor.get_default();
      this._pihole = null;

      this._configure();
      this._setHandlers();
      this._start().catch(console.error);
    }

    _configure() {
      this._hideUi = this._settings.get_boolean("hideui");
      this._restrict = this._settings.get_boolean("restrict");
      this._networks = this._settings.get_string("networks");
      this._multimode = this._settings.get_boolean("multimode");
    }

    _setHandlers() {
      this._networkHandlerId = this._network_monitor.connect(
        "network-changed",
        () => {
          this._start().catch(console.error);
        }
      );

      this._settingsHandlerId = this._settings.connect("changed", () => {
        this._configure();
        this._start().catch(console.error);
      });
    }

    async _start() {
      const Pihole = this._multimode ? MultiInstance : SingleInstance;

      this._pihole?.destroy();
      this._pihole = null;

      if (this._network_monitor.network_available) {
        if (this._restrict && this._hideUi) {
          const currentNetworkId = await DBus.getNetworkIdAsync();

          this._pihole = this._networks.split(";").includes(currentNetworkId)
            ? new Pihole(this._me, this._settings, "start")
            : null;
        } else if (this._restrict) {
          const currentNetworkId = await DBus.getNetworkIdAsync();

          this._pihole = this._networks.split(";").includes(currentNetworkId)
            ? new Pihole(this._me, this._settings, "start")
            : new Pihole(this._me, this._settings, "unknown_network");
        } else {
          this._pihole = new Pihole(this._me, this._settings, "start");
        }
      } else {
        if (!this._hideUi)
          this._pihole = new Pihole(this._me, this._settings, "no_network");
      }
    }

    destroy() {
      this._settings.disconnect(this._settingsHandlerId);
      this._settings = null;

      this._network_monitor.disconnect(this._networkHandlerId);

      this._pihole?.destroy();
      this._pihole = null;
    }
  }
);
