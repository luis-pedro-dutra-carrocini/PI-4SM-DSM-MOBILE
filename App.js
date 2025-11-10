import React from "react";
import Routes from "./src/routes";
import { useEffect } from "react";
import { Appearance } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import { TASK_NAME } from "./src/tasks/backgroundTask";


// Solicitar permissão de notificação
async function solicitarPermissaoNotificacao() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    alert("Permissão para notificações não concedida!");
  }
}

export default function App() {

  useEffect(() => {
    solicitarPermissaoNotificacao();
    iniciarServico();
  }, []);

  useEffect(() => {
    // Força o modo claro
    Appearance.setColorScheme('light');
  }, []);

  async function iniciarServico() {
    const status = await BackgroundFetch.getStatusAsync();
    console.log("Status do background fetch:", status);

    // Cancela se já estiver ativo
    const tasks = await TaskManager.getRegisteredTasksAsync();
    const jaRegistrado = tasks.some(t => t.taskName === TASK_NAME);
    if (jaRegistrado) return;

    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60, // a cada 1 minuto
      stopOnTerminate: false, // continua mesmo se o app for fechado
      startOnBoot: true, // reinicia após reinicializar o aparelho
      foregroundService: {
        notificationTitle: "Monitoramento ativo",
        notificationBody: "O aplicativo está monitorando seu peso em segundo plano.",
        notificationColor: "#2196f3",
      },
    });

    console.log("✅ Serviço em primeiro plano iniciado!");
    const registered = await TaskManager.getRegisteredTasksAsync();
    console.log("Tasks registradas:", registered.map(t => t.taskName));
  }

  return <Routes />;

}