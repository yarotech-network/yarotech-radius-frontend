import type { IsoDateTime, PageParams } from './common';

export interface MacDevice {
  id: number;
  /** Normalised to XX:XX:XX:XX:XX:XX by the server. */
  mac_address: string;
  device_name: string;
  plan: number;
  plan_name: string;
  tenant: number;
  is_active: boolean;
  expires_at: IsoDateTime | null;
  router?: string | null;
  router_name?: string | null;
  router_location?: string | null;
  access_type?: 'permanent' | 'timed';
  vlan_id?: number | null;
  description?: string;
  accounting?: {
    available: boolean;
    session_count: number | null;
    open_sessions: number | null;
    bytes_total: number | null;
    last_connected_at: IsoDateTime | null;
  } | null;
  created_at: IsoDateTime;
}

export interface MacDeviceWrite {
  mac_address: string;
  device_name: string;
  plan: number;
  is_active?: boolean;
  expires_at: IsoDateTime | null;
  router?: string | null;
  access_type?: 'permanent' | 'timed';
  vlan_id?: number | null;
  description?: string;
}

export interface DeviceListParams extends PageParams {
  router?: string;
  is_active?: boolean;
  plan?: number;
}

/** `access_token_encrypted` is write-only. One route per tenant. */
export interface WhatsAppRoute {
  id: number;
  tenant: number;
  phone_number_id: string;
  is_active: boolean;
  created_at: IsoDateTime;
}

export interface WhatsAppRouteWrite {
  phone_number_id: string;
  access_token_encrypted?: string;
  is_active?: boolean;
}
