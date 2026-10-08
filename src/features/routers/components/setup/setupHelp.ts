/**
 * Plain-language help for router setup. The `YT-*` codes are printed by the RouterOS script
 * (apps/routers/legacy_script.py and legacy_hotspot_setup.py); keep both sides in sync.
 */
export interface SetupProblem {
  code: string;
  title: string;
  fix: string;
}

export const SETUP_PROBLEMS: readonly SetupProblem[] = [
  {
    code: 'YT-PRE-01',
    title: 'RouterOS is too old',
    fix: 'Upgrade the router to RouterOS 7.17 or newer (System → Packages → Check For Updates), then run the command again.',
  },
  {
    code: 'YT-PRE-02',
    title: 'HotSpot is blocked by device mode',
    fix: 'In the terminal run /system/device-mode/update hotspot=yes, then press the router’s reset button briefly (or power-cycle) when asked to confirm.',
  },
  {
    code: 'YT-PRE-03',
    title: 'A required HotSpot queue type is missing',
    fix: 'The router’s default queue types were removed. Restore them, or reset the router to its default configuration, then try again.',
  },
  {
    code: 'YT-LAN-01',
    title: 'The customer port was not found',
    fix: 'Check the exact interface name in WinBox → Interfaces. If the port is part of a bridge, use the bridge name. Edit the router to fix it, then get a new command.',
  },
  {
    code: 'YT-LAN-02',
    title: 'The customer network clashes with existing settings',
    fix: 'Another address, address pool or DHCP server already uses this network or port. Choose an unused network (e.g. 10.20.0.1/24), or reuse the existing DHCP server under Advanced network settings.',
  },
  {
    code: 'YT-HS-01',
    title: 'An existing HotSpot is in the way',
    fix: 'The port or profile is already used by another HotSpot. Use “Connect an existing HotSpot” with its profile name, or remove the old HotSpot first.',
  },
  {
    code: 'YT-HS-02',
    title: 'Login page files could not be prepared',
    fix: 'The router’s storage may be full. Free some space in Files, then run the command again.',
  },
  {
    code: 'YT-NAT-01',
    title: 'Internet sharing (NAT) settings conflict',
    fix: 'Check the internet (WAN) interface name, or keep the router’s existing NAT under Advanced network settings.',
  },
  {
    code: 'YT-WG-01',
    title: 'A different Yarotech VPN identity is already on this router',
    fix: 'This router was set up for another Yarotech router record. Use that record, or remove the old wg-yarotech interface before trying again.',
  },
  {
    code: 'YT-WG-02',
    title: 'The route to Yarotech could not be set',
    fix: 'Remove duplicate routes commented YAROTECH in IP → Routes, then run the command again.',
  },
  {
    code: 'YT-RAD-01',
    title: 'A different Yarotech RADIUS entry is already on this router',
    fix: 'Remove the RADIUS entry commented YAROTECH-CENTRAL-RADIUS in the Radius menu, then run the command again.',
  },
  {
    code: 'YT-DUP-01',
    title: 'Duplicate Yarotech settings were found',
    fix: 'An earlier setup left two copies of a Yarotech item. Remove the extra copy (look for comments starting with YAROTECH), then run the command again.',
  },
  {
    code: 'YT-GEN-01',
    title: 'An existing setting differs from what Yarotech expects',
    fix: 'Nothing was overwritten. Contact support with the full error line from the terminal.',
  },
];

/** Why server preparation stopped (registration.error_code). */
export const PREPARATION_ERRORS: Record<string, string> = {
  server_configuration_required:
    'The Yarotech server is missing its VPN or RADIUS settings. An administrator needs to finish the server setup, then retry.',
  server_provisioning_disabled:
    'Automatic server preparation is switched off on this server. The router is saved; ask an administrator to enable it, then retry.',
  provisioning_failed:
    'Yarotech could not prepare the VPN for this router. Retry in a moment; the router keeps its identity.',
};
