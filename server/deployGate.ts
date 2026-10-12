
let maintenanceActive = false;
let pendingRoomCreations = 0;

export function isMaintenanceActive(): boolean {
  return maintenanceActive;
}

export function beginRoomCreation(): void {
  if (maintenanceActive) {
    throw new Error(
      'Der Spielserver wird aktualisiert. Bitte später erneut versuchen.'
    );
  }
  pendingRoomCreations++;
}

export function endRoomCreation(): void {
  pendingRoomCreations = Math.max(0, pendingRoomCreations - 1);
}

export function tryBeginMaintenance(
  roomCount: number,
  connectedPlayers: number
): boolean {
  if (
    maintenanceActive ||
    pendingRoomCreations !== 0 ||
    roomCount !== 0 ||
    connectedPlayers !== 0
  ) {
    return false;
  }

  maintenanceActive = true;
  return true;
}

export function endMaintenance(): void {
  maintenanceActive = false;
}
