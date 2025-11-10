import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackgroundFetchResult } from "expo-background-fetch";
import { pegarTokens, obterDadosUsuario, roundTo2 } from "../utils/validacoes";
import { LINKAPI, PORTAPI } from "../utils/global";

export const TASK_NAME = "MONITORAMENTO_PESO";

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    console.log("⏱️ Executando tarefa de monitoramento em background...");

    const notificacoesAtivas = await AsyncStorage.getItem("notificacoesAtivas");
    if (notificacoesAtivas === "false") {
      console.log("🔕 Notificações desativadas pelo usuário.");
      return BackgroundFetchResult.NoData;
    }


    // 1️⃣ Obtém dados do usuário autenticado
    const dadosUsuario = await obterDadosUsuario();

    if (!dadosUsuario || dadosUsuario === "false") {
      console.warn("Usuário não autenticado — encerrando monitoramento.");
      return BackgroundFetchResult.NoData;
    }

    const tokens = await pegarTokens();
    if (!tokens || !tokens.accessToken) {
      console.warn("Tokens ausentes — tarefa cancelada.");
      return BackgroundFetchResult.NoData;
    }

    const { accessToken } = tokens;

    // Peso máximo permitido
    const pesoUsuario = Number(dadosUsuario.usuario.UsuarioPeso || 70);
    const porcentagemMax = Number(
      dadosUsuario.usuario.UsuarioPesoMaximoPorcentagem || 10
    );
    const pesoMaximoPermitido = pesoUsuario * (porcentagemMax / 100);

    // 2️⃣ Busca a mochila atualmente em uso
    const responseMochila = await fetch(
      `${LINKAPI}${PORTAPI}/usuarios-mochilas/mochilaUso`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!responseMochila.ok) {
      console.log("Nenhuma mochila em uso.");
      return BackgroundFetchResult.NoData;
    }

    const dataMochila = await responseMochila.json();
    const mochilaCodigo = dataMochila.mochila?.MochilaCodigo;

    if (!mochilaCodigo) {
      console.log("Mochila sem código válido.");
      return BackgroundFetchResult.NoData;
    }

    // 3️⃣ Busca as medições atuais da mochila
    const responseMedicao = await fetch(
      `${LINKAPI}${PORTAPI}/medicoes/atual/${mochilaCodigo}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!responseMedicao.ok) {
      console.log("Falha ao buscar medições atuais.");
      return BackgroundFetchResult.NoData;
    }

    const dataMedicao = await responseMedicao.json();

    // 4️⃣ Calcula o peso total atual
    const pesoEsquerdo = Number(dataMedicao.esquerda?.MedicaoPeso || 0);
    const pesoDireito = Number(dataMedicao.direita?.MedicaoPeso || 0);
    const pesoTotal = roundTo2(pesoEsquerdo + pesoDireito);

    console.log(
      `📦 Peso total atual: ${pesoTotal} kg / Limite: ${pesoMaximoPermitido} kg`
    );

    // 5️⃣ Verifica se já enviamos uma notificação anterior
    const notificacaoEnviada = await AsyncStorage.getItem("notificacaoEnviada");

    // 6️⃣ Regras de notificação
    if (pesoTotal > pesoMaximoPermitido) {
      // Excedeu o limite
      if (notificacaoEnviada !== "true") {
        // Ainda não tinha enviado — envia agora
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ Alerta de Peso!",
            body: `O peso atual (${pesoTotal.toFixed(
              2
            )} kg) excede o limite de ${pesoMaximoPermitido.toFixed(2)} kg.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // dispara imediatamente
        });

        await AsyncStorage.setItem("notificacaoEnviada", "true");
        console.log("🚨 Notificação enviada!");
      } else {
        console.log("⚠️ Peso ainda excede limite, notificação já enviada.");
      }
    } else {
      // Peso voltou ao normal
      if (notificacaoEnviada === "true") {
        console.log("✅ Peso normalizado, resetando estado da notificação.");
        await AsyncStorage.setItem("notificacaoEnviada", "false");
      } else {
        console.log("✅ Peso dentro do limite.");
      }
    }

    return BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("❌ Erro na tarefa de monitoramento:", error);
    return BackgroundFetchResult.Failed;
  }
});
