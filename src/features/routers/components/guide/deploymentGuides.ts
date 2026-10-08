/**
 * Step-by-step WinBox guides for common router layouts. Field values must stay valid for
 * the Add router form (addRouter/model.ts) and the setup script (backend legacy_hotspot_setup.py),
 * which accepts the factory `defconf` DHCP server and `default-dhcp` pool when reused.
 */
export type GuideId = 'default' | 'wavlink' | 'multi-ap' | 'builtin-wifi' | 'existing';

export interface GuideStep {
  title: string;
  /** Plain sentences; **bold** marks WinBox menus and buttons. */
  points: string[];
  /** RouterOS terminal commands that do the same as the WinBox clicks. */
  commands?: string[];
  /** Exact values for the Add router form. */
  fields?: [label: string, value: string][];
  note?: string;
}

export interface DeploymentGuide {
  id: GuideId;
  label: string;
  /** One line shown on the picker card. */
  bestFor: string;
  summary: string;
  wiring: [port: string, connection: string][];
  steps: GuideStep[];
}

/** Lets Yarotech reach the router over its VPN through the default "drop all not from LAN" rule. */
const MONITORING_STEP: GuideStep = {
  title: 'Let Yarotech monitor the router',
  points: [
    'MikroTik’s default firewall only trusts the LAN list. Add the Yarotech VPN to it so Yarotech can check the router and disconnect expired customers.',
    'WinBox: **Interfaces → Interface List → +**, List **LAN**, Interface **wg-yarotech**, then **OK**.',
  ],
  commands: ['/interface list member add list=LAN interface=wg-yarotech comment="Yarotech VPN"'],
};

const INSTALL_STEP: GuideStep = {
  title: 'Install with one command',
  points: [
    'Open the router’s **Setup** tab in Yarotech and click **Get install command**.',
    'In WinBox open **New Terminal**, paste the command and press **Enter**.',
    'Wait about a minute for “Yarotech setup finished”. If it stops with a code such as YT-LAN-02, look it up on the Setup tab, fix it and get a new command.',
  ],
};

/** Moves `ports` out of the factory bridge into a dedicated HotSpot bridge the default firewall trusts. */
function customerBridgeStep(ports: string[], what: string): GuideStep {
  return {
    title: 'Create the customer bridge',
    points: [
      'Make a bridge just for customers: **Bridge → +**, Name **bridge-hotspot**, then **OK**.',
      `Move ${what} into it: in **Bridge → Ports** open ${ports.map((port) => `**${port}**`).join(' and ')} and change Bridge from **bridge** to **bridge-hotspot**.`,
      'Let the default firewall trust it: **Interfaces → Interface List → +**, List **LAN**, Interface **bridge-hotspot**.',
      'Everything still on **bridge** (192.168.88.x) stays private, so your laptop keeps working.',
    ],
    commands: [
      '/interface bridge add name=bridge-hotspot comment="Yarotech HotSpot"',
      ...ports.map(
        (port) => `/interface bridge port set [find interface=${port}] bridge=bridge-hotspot`,
      ),
      '/interface list member add list=LAN interface=bridge-hotspot comment="Yarotech HotSpot"',
    ],
  };
}

export const DEPLOYMENT_GUIDES: readonly DeploymentGuide[] = [
  {
    id: 'default',
    label: 'Default configuration',
    bestFor: 'Fresh router, quickest setup',
    summary:
      'Quickest. Use this when the router still has MikroTik’s factory settings. All LAN ports (ether2–ether5) and the router’s own Wi-Fi become the HotSpot.',
    wiring: [
      ['ether1', 'Internet (ISP modem or fibre box)'],
      ['ether2–ether5', 'Customers (cables or switches)'],
      ['Built-in Wi-Fi', 'Customers'],
    ],
    steps: [
      {
        title: 'Connect and check the router',
        points: [
          'Plug your laptop into ether2 and open **WinBox**. Under **Neighbors**, connect using the router’s **MAC address** (user admin; the password is on the router’s sticker, or blank on older models).',
          'Connecting by MAC address keeps working after the HotSpot is on; an IP connection will be captured by the login page.',
          '**System → Resources**: RouterOS must be **7.17 or newer**.',
          '**IP → DHCP Server** should list **defconf** on **bridge**, and **IP → Pool** should list **default-dhcp**. If they are missing, the factory settings were removed — use the custom guide instead.',
          'Save a backup: **Files → Backup → Backup**.',
        ],
        commands: ['/system resource print', '/ping 8.8.8.8 count=3', '/ip dhcp-server print'],
      },
      {
        title: 'Add the router in Yarotech',
        points: [
          'Click **Add router** and enter exactly these values. Leave every other field as it is.',
        ],
        fields: [
          ['Customer port', 'bridge'],
          ['How should Yarotech set up this router?', 'Set up a new HotSpot'],
          ['Customer network (gateway)', '192.168.88.1/24'],
          ['Advanced → DHCP setup', 'Reuse an existing DHCP server'],
          ['Existing address pool', 'default-dhcp'],
          ['Existing DHCP server', 'defconf'],
          ['Internet sharing (NAT)', 'Keep the router’s existing NAT'],
        ],
      },
      INSTALL_STEP,
      MONITORING_STEP,
      {
        title: 'Keep your own laptop online (optional)',
        points: [
          'Your laptop is now behind the HotSpot too. To skip the login page for it: **IP → Hotspot → IP Bindings → +**, enter its MAC address and set Type **bypassed**.',
        ],
        commands: [
          '/ip hotspot ip-binding add mac-address=AA:BB:CC:DD:EE:FF type=bypassed comment="Admin laptop"',
        ],
        note: 'Replace AA:BB:CC:DD:EE:FF with your laptop’s MAC address.',
      },
      {
        title: 'Test with a phone',
        points: [
          'Join the router’s Wi-Fi or plug a device into ether2–ether5. You should get a 192.168.88.x address and the login page should open.',
          'Log in with a test voucher. The Setup tab turns green as each check passes.',
        ],
      },
    ],
  },
  {
    id: 'wavlink',
    label: 'Custom: WAVLINK on ether2',
    bestFor: 'One access point, private management port',
    summary:
      'Recommended for shops. Customers connect through a WAVLINK access point on ether2; you manage the router from ether3, which stays private.',
    wiring: [
      ['ether1', 'Internet (ISP modem or fibre box)'],
      ['ether2', 'WAVLINK access point (customers)'],
      ['ether3', 'Your laptop (management)'],
    ],
    steps: [
      {
        title: 'Prepare the WAVLINK',
        points: [
          'Open the WAVLINK’s settings page (see its label, usually **wifi.wavlink.com** or **192.168.10.1**).',
          'Set the working mode to **Access Point (AP)** so the MikroTik hands out addresses and shows the login page. If there is a DHCP server option, turn it **off**.',
          'Set the Wi-Fi name customers will see, e.g. “Yarotech WiFi”. Leave it open — vouchers control access.',
          'Connect a cable from MikroTik **ether2** to the WAVLINK (its LAN port, or the port its manual names for AP mode).',
        ],
      },
      {
        title: 'Connect and check the MikroTik',
        points: [
          'Plug your laptop into **ether3** and open **WinBox** (connect by MAC address or 192.168.88.1).',
          '**System → Resources**: RouterOS must be **7.17 or newer**. Check the router has internet.',
          'Save a backup: **Files → Backup → Backup**.',
          'This guide assumes the factory settings (a **bridge** with ether2–ether5). On a blank router, restore them first with **System → Reset Configuration** (leave “No Default Configuration” unticked).',
        ],
        commands: ['/system resource print', '/ping 8.8.8.8 count=3'],
      },
      {
        title: 'Free ether2 for the HotSpot',
        points: [
          'Take ether2 out of the default bridge: **Bridge → Ports**, select **ether2**, click **−**.',
          'Let the default firewall trust it: **Interfaces → Interface List → +**, List **LAN**, Interface **ether2**.',
          'ether3–ether5 stay on the bridge (192.168.88.x), so your laptop on ether3 keeps working.',
        ],
        commands: [
          '/interface bridge port remove [find interface=ether2]',
          '/interface list member add list=LAN interface=ether2 comment="Yarotech HotSpot"',
        ],
      },
      {
        title: 'Add the router in Yarotech',
        points: [
          'Click **Add router** and enter these values. The customer network is already filled in; leave **Advanced network settings** as they are (a new DHCP server and the router’s existing NAT).',
        ],
        fields: [
          ['Customer port', 'ether2'],
          ['How should Yarotech set up this router?', 'Set up a new HotSpot'],
          ['Customer network (gateway)', '10.20.0.1/24'],
          ['Internet sharing (NAT)', 'Keep the router’s existing NAT'],
        ],
      },
      INSTALL_STEP,
      MONITORING_STEP,
      {
        title: 'Test with a phone',
        points: [
          'Join the WAVLINK Wi-Fi. You should get a 10.20.0.x address and the login page should open.',
          'Log in with a test voucher. The Setup tab turns green as each check passes.',
          'No address? Check the WAVLINK is in Access Point mode with its DHCP off, and the cable is in MikroTik ether2.',
        ],
      },
    ],
  },
  {
    id: 'multi-ap',
    label: 'Several access points',
    bestFor: 'Bigger sites with 2 or more WAVLINKs',
    summary:
      'Customers connect through access points on ether2 and ether4 (add more ports the same way). Both ports join one customer network, so phones stay logged in when they move between access points. ether3 stays your private management port.',
    wiring: [
      ['ether1', 'Internet (ISP modem or fibre box)'],
      ['ether2, ether4', 'Access points (customers)'],
      ['ether3', 'Your laptop (management)'],
    ],
    steps: [
      {
        title: 'Prepare every access point',
        points: [
          'Set each access point to **Access Point (AP)** mode and turn its DHCP server **off**.',
          'Give them all the **same Wi-Fi name** and leave it open, so customers roam between them.',
          'Use different Wi-Fi channels on neighbouring access points (for example 1, 6 and 11).',
        ],
      },
      {
        title: 'Connect and check the MikroTik',
        points: [
          'Plug your laptop into **ether3** and open **WinBox**.',
          '**System → Resources**: RouterOS must be **7.17 or newer**. Save a backup: **Files → Backup → Backup**.',
        ],
        commands: ['/system resource print', '/ping 8.8.8.8 count=3'],
      },
      customerBridgeStep(['ether2', 'ether4'], 'the access-point ports'),
      {
        title: 'Add the router in Yarotech',
        points: [
          'Click **Add router** and enter these values. Leave **Advanced network settings** as they are.',
        ],
        fields: [
          ['Customer port', 'bridge-hotspot'],
          ['How should Yarotech set up this router?', 'Set up a new HotSpot'],
          ['Customer network (gateway)', '10.20.0.1/24'],
          ['Internet sharing (NAT)', 'Keep the router’s existing NAT'],
        ],
        note: 'A /24 network serves up to 253 devices at once. For more, enter 10.20.0.1/22 (1,021 devices).',
      },
      INSTALL_STEP,
      MONITORING_STEP,
      {
        title: 'Test with a phone',
        points: [
          'Join the Wi-Fi near each access point. You should get a 10.20.0.x address and the login page.',
          'Log in with a test voucher, then walk to another access point — you should stay logged in.',
        ],
      },
    ],
  },
  {
    id: 'builtin-wifi',
    label: 'Built-in Wi-Fi for customers',
    bestFor: 'Small shops; wired ports stay private',
    summary:
      'Customers use the MikroTik’s own Wi-Fi, while the wired ports (ether2–ether5) stay private for your office or staff. The Wi-Fi goes into its own bridge because Yarotech sets the HotSpot up on a bridge or Ethernet port.',
    wiring: [
      ['ether1', 'Internet (ISP modem or fibre box)'],
      ['Built-in Wi-Fi', 'Customers'],
      ['ether2–ether5', 'Your laptop and staff (private)'],
    ],
    steps: [
      {
        title: 'Find the Wi-Fi interfaces',
        points: [
          'Plug your laptop into **ether2** and open **WinBox**. Check **System → Resources** shows RouterOS **7.17 or newer**, and save a backup.',
          'In **Interfaces**, note the Wi-Fi names: **wifi1** and **wifi2** on newer models, **wlan1** and **wlan2** on older ones. The commands below use wifi1 and wifi2 — change them if yours differ.',
        ],
        commands: ['/interface print where type~"wifi|wlan"'],
      },
      {
        title: 'Open the Wi-Fi for customers',
        points: [
          'Open each Wi-Fi interface in **WiFi** (newer) or **Wireless** (older) and set the network name (SSID), e.g. “Yarotech WiFi”.',
          'Remove the Wi-Fi password (open security) — vouchers control access.',
        ],
      },
      customerBridgeStep(['wifi1', 'wifi2'], 'the Wi-Fi'),
      {
        title: 'Add the router in Yarotech',
        points: [
          'Click **Add router** and enter these values. Leave **Advanced network settings** as they are.',
        ],
        fields: [
          ['Customer port', 'bridge-hotspot'],
          ['How should Yarotech set up this router?', 'Set up a new HotSpot'],
          ['Customer network (gateway)', '10.20.0.1/24'],
          ['Internet sharing (NAT)', 'Keep the router’s existing NAT'],
        ],
      },
      INSTALL_STEP,
      MONITORING_STEP,
      {
        title: 'Test with a phone',
        points: [
          'Join the router’s Wi-Fi. You should get a 10.20.0.x address and the login page should open.',
          'Your laptop on a wired port should still browse normally, with no login page.',
        ],
      },
    ],
  },
  {
    id: 'existing',
    label: 'Router already has a HotSpot',
    bestFor: 'Keep your current HotSpot and login page',
    summary:
      'The router already runs a HotSpot you set up yourself. Yarotech only adds its VPN and RADIUS and switches your HotSpot profile to Yarotech vouchers; your network, login page and ports stay as they are.',
    wiring: [
      ['ether1', 'Internet (as today)'],
      ['HotSpot port', 'Customers (as today)'],
      ['Other ports', 'Unchanged'],
    ],
    steps: [
      {
        title: 'Find your HotSpot server and profile',
        points: [
          'Open **WinBox**. In **IP → Hotspot → Servers**, note the server’s **Interface** and **Profile** (often **hsprof1**). There must be exactly one HotSpot on that interface.',
          'Check **System → Resources** shows RouterOS **7.17 or newer**, and save a backup: **Files → Backup → Backup**.',
        ],
        commands: ['/ip hotspot print', '/ip hotspot profile print'],
      },
      {
        title: 'Add the router in Yarotech',
        points: [
          'Click **Add router**, enter the HotSpot’s interface and choose **Connect an existing HotSpot**.',
        ],
        fields: [
          ['Customer port', 'bridge'],
          ['How should Yarotech set up this router?', 'Connect an existing HotSpot'],
          ['Existing HotSpot profile', 'hsprof1'],
        ],
        note: 'Use your own interface and profile names if they differ from bridge and hsprof1.',
      },
      INSTALL_STEP,
      MONITORING_STEP,
      {
        title: 'Test with a phone',
        points: [
          'Open your usual HotSpot login page and log in with a Yarotech test voucher.',
          'The Setup tab turns green as each check passes.',
        ],
      },
    ],
  },
];

/** Situations that apply to any layout above. */
export const GOOD_TO_KNOW: readonly { title: string; text: string; commands?: string[] }[] = [
  {
    title: 'Internet over PPPoE (ISP username and password)',
    text: 'Create the connection in **PPP → +** (PPPoE Client on ether1) and check it shows **R** (running). Make sure the factory NAT covers it by adding **pppoe-out1** to the **WAN** interface list, then keep “Internet sharing (NAT)” on the router’s existing NAT.',
    commands: ['/interface list member add list=WAN interface=pppoe-out1 comment="ISP PPPoE"'],
  },
  {
    title: 'Many access points on one MikroTik port',
    text: 'Plug a switch into ether2 and the access points into the switch, then follow the WAVLINK guide. Use a plain switch, not another router.',
  },
  {
    title: 'Blank or reset router',
    text: 'These guides start from MikroTik’s factory settings (ether1 internet, a **bridge** with the other ports). On a blank router, restore them with **System → Reset Configuration**, leaving “No Default Configuration” unticked, then reconnect by MAC address.',
  },
  {
    title: 'Different port numbers',
    text: 'Any Ethernet port except ether1 (internet) can be the customer or management port. Swap the port names in the steps and in the Customer port field.',
  },
];
