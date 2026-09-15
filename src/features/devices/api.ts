import { http } from '@/services/api/http';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type { DeviceListParams, MacDevice, MacDeviceWrite, Paginated } from '@/types/api';

/** MAC-authenticated devices (`iot-devices/`): list/retrieve for any member, writes for managers. */
export const devicesApi = {
  list(params: DeviceListParams) {
    return http.get<Paginated<MacDevice>>('/iot-devices/', { ...params });
  },
  get(id: number) {
    return http.get<MacDevice>(`/iot-devices/${id}/`);
  },
  create(payload: MacDeviceWrite, idempotencyKey = newIdempotencyKey('device')) {
    return http.post<MacDevice>('/iot-devices/', payload, { idempotencyKey });
  },
  update(id: number, payload: Partial<MacDeviceWrite>) {
    return http.patch<MacDevice>(`/iot-devices/${id}/`, payload);
  },
  renew(id: number, plan: number, version: number, idempotencyKey: string) {
    return http.post<MacDevice>(
      `/iot-devices/${id}/renew/`,
      { plan, expected_version: version },
      { idempotencyKey },
    );
  },
  lifecycle(id: number, action: string, version: number, idempotencyKey: string) {
    return http.post<MacDevice>(
      `/iot-devices/${id}/lifecycle/`,
      { action, expected_version: version },
      { idempotencyKey },
    );
  },
  remove(id: number, version: number) {
    return http.delete(`/iot-devices/${id}/?expected_version=${version}`);
  },
};
