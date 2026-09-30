export function shouldBlockForMaintenance(isAdmin: boolean, settingValue: unknown) {
  return !isAdmin && settingValue === true
}
