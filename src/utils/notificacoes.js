import * as Notifications from "expo-notifications";

// Configura o comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Função para pedir permissão
export async function solicitarPermissaoNotificacao() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    alert("Permissão para notificações negada!");
  }
}

// Função para disparar notificação
export async function enviarNotificacao(titulo, corpo) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body: corpo,
      sound: true,
    },
    trigger: null, // dispara imediatamente
  });
}
