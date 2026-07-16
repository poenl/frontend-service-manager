import Conf from "conf";

export interface ServiceConfig {
  id: string;
  name: string;
  projectDir: string;
  backendHost: string;
  backendPort: string;
  frontendPort: string;
}

interface Store {
  services: ServiceConfig[];
}

let _store: Conf<Store> | null = null;

function store(): Conf<Store> {
  if (!_store) {
    _store = new Conf<Store>({
      projectName: "ui-server",
      defaults: { services: [] },
    });
  }
  return _store;
}

export function getServices(): ServiceConfig[] {
  return store().get("services");
}

export function getService(id: string): ServiceConfig | undefined {
  return store().get("services").find((s) => s.id === id);
}

export function addService(
  input: Omit<ServiceConfig, "id">
): ServiceConfig {
  const svc: ServiceConfig = {
    id: crypto.randomUUID(),
    ...input,
  };
  store().set("services", [...store().get("services"), svc]);
  return svc;
}

export function updateService(
  id: string,
  patch: Partial<ServiceConfig>
): ServiceConfig | undefined {
  const services = store().get("services");
  const idx = services.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  const updated = { ...services[idx], ...patch, id };
  services[idx] = updated;
  store().set("services", services);
  return updated;
}

export function deleteService(id: string): boolean {
  const services = store().get("services");
  const filtered = services.filter((s) => s.id !== id);
  if (filtered.length === services.length) return false;
  store().set("services", filtered);
  return true;
}
