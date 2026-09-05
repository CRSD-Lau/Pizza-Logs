export async function requestUploadNotifications(): Promise<NotificationPermission | null> {
  if (typeof Notification === "undefined") return null;
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

export function sendUploadNotification(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body, icon: "/favicon.ico" });
    setTimeout(() => notification.close(), 8000);
  } catch {
    // Some browsers expose permission without supporting window notifications.
    // Notification support must never change the upload result.
  }
}
