import * as SecureStore from "expo-secure-store";
import { LINKAPI, PORTAPI } from "./global";
//import { console } from "inspector";

export function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validarSenha(senha) {
  if (senha.length < 8 || senha.length > 16) {
    return { valido: false, erro: "A senha deve ter de 8 à 16 caracteres." };
  }

  const qtdMaiusculas = (senha.match(/[A-Z]/g) || []).length;
  const qtdMinusculas = (senha.match(/[a-z]/g) || []).length;
  const qtdNumeros = (senha.match(/[0-9]/g) || []).length;
  const qtdEspeciais = (senha.match(/[^A-Za-z0-9]/g) || []).length;

  if (qtdMaiusculas < 2) {
    return { valido: false, erro: "A senha deve ter pelo menos 2 letras maiúsculas." };
  }
  if (qtdMinusculas < 2) {
    return { valido: false, erro: "A senha deve ter pelo menos 2 letras minúsculas." };
  }
  if (qtdNumeros < 2) {
    return { valido: false, erro: "A senha deve ter pelo menos 2 números." };
  }
  if (qtdEspeciais < 2) {
    return { valido: false, erro: "A senha deve ter pelo menos 2 caracteres especiais." };
  }

  return { valido: true, mensagem: "Senha válida!" };
}

// Calcula a diferença entre duas datas em dias, semanas, meses ou anos
// O parâmetro `decimal` define se o resultado será decimal (true) ou inteiro arredondado para baixo (false)
export function diferencaEntreDatas(data1, data2, unidade, decimal) {
  const inicio = new Date(data1);
  const fim = new Date(data2);

  if (isNaN(inicio) || isNaN(fim)) {
    return false; // datas inválidas
  }

  // Diferença em milissegundos
  const diffMs = Math.abs(fim - inicio);

  switch (unidade.toLowerCase()) {
    case "dias": {
      const dias = diffMs / (1000 * 60 * 60 * 24);
      return decimal ? dias : Math.floor(dias);
    }

    case "semanas": {
      const semanas = diffMs / (1000 * 60 * 60 * 24 * 7);
      return decimal ? semanas : Math.floor(semanas);
    }

    case "meses": {
      // Diferença em meses aproximada com dias
      const anos = fim.getFullYear() - inicio.getFullYear();
      const meses = fim.getMonth() - inicio.getMonth();
      const dias = fim.getDate() - inicio.getDate();

      let totalMeses = anos * 12 + meses + dias / 30.4375; // 30.4375 = média de dias por mês
      return decimal ? totalMeses : Math.floor(totalMeses);
    }

    case "anos": {
      // Diferença em anos considerando meses e dias
      const anos = fim.getFullYear() - inicio.getFullYear();
      const meses = fim.getMonth() - inicio.getMonth();
      const dias = fim.getDate() - inicio.getDate();

      let totalAnos = anos + meses / 12 + dias / 365.25; // 365.25 = média de dias por ano (considera bissextos)
      return decimal ? totalAnos : Math.floor(totalAnos);
    }

    default:
      return false;
  }
}

// Salvar tokens
export async function salvarTokens(accessToken, refreshToken) {
  await SecureStore.setItemAsync("accessToken", String(accessToken));
  await SecureStore.setItemAsync("refreshToken", String(refreshToken));
}

// Buscar tokens
export async function pegarTokens() {
  const accessToken = await SecureStore.getItemAsync("accessToken");
  const refreshToken = await SecureStore.getItemAsync("refreshToken");
  return { accessToken, refreshToken };
}

// Remover tokens (logout)
export async function limparTokens() {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
}

export async function validarTokens(tentativas = 0, navigation) {
  try {
    console.log("🔁 Tentativas de validação:", tentativas);

    // 🔒 Limite de tentativas
    if (tentativas >= 5) {
      console.log("🚫 Tentativas excedidas");
      await limparTokens();
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      return "false";
    }

    // Timeout de 3s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { accessToken, refreshToken } = await pegarTokens();

    // 🧩 Tokens ausentes
    if (!accessToken || !refreshToken) {
      console.log("⚠️ Tokens ausentes");
      await limparTokens();
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      return "false";
    }

    // 🧠 1️⃣ Tenta validar o accessToken
    let response = await fetch(LINKAPI + PORTAPI + "/token/validarToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      console.log("✅ Token válido");
      return "true";
    }

    // 🧠 2️⃣ Tenta renovar com o refreshToken
    response = await fetch(LINKAPI + PORTAPI + "/token/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      await salvarTokens(data.accessToken, refreshToken);
      console.log("🔄 Token renovado com sucesso");
      return "true";
    }

    // 🧠 3️⃣ Falha ao renovar
    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (data.error === "Usuário não autenticado") {
      console.log("🚫 Usuário não autenticado");
      await limparTokens();
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      return "false";
    }

    console.log("⚠️ Falha ao renovar token, nova tentativa...");
    await new Promise(res => setTimeout(res, 1000));
    return await validarTokens(tentativas + 1, navigation);

  } catch (error) {
    if (error.name === "AbortError") {
      console.log("⏰ Timeout ao validar token");
    } else {
      console.log("💥 Erro ao conectar no servidor:", error.message);
    }

    await new Promise(res => setTimeout(res, 1000));
    return await validarTokens(tentativas + 1, navigation);
  }
}


export async function obterDadosUsuario(navigation, tentativas = 0) {
  try {
    console.log("📡 Tentando obter dados do usuário (tentativa", tentativas + 1, ")");

    // Evita loop infinito
    if (tentativas >= 2) {
      console.log("🚫 Tentativas máximas de obtenção de dados atingidas");
      return "false";
    }

    // Timeout 3s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { accessToken, refreshToken } = await pegarTokens();

    if (!accessToken || !refreshToken) {
      console.log("⚠️ Tokens ausentes ao obter dados");
      await limparTokens();
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      return "false";
    }

    // 🔐 1️⃣ Tenta obter os dados com o token atual
    let response = await fetch(LINKAPI + PORTAPI + "/usuarios/id", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 🔐 2️⃣ Se o accessToken expirou, tenta renovar
    if (!response.ok) {
      console.log("⚠️ Token expirado ao obter dados, tentando renovar...");

      const validado = await validarTokens(0, navigation);
      if (validado === "false") {
        console.log("🚫 Token inválido mesmo após renovação");
        return "false";
      }

      // Faz nova tentativa APENAS UMA VEZ após renovação
      return await obterDadosUsuario(navigation, tentativas + 1);
    }

    // 🔐 3️⃣ Retorna dados do usuário
    const data = await response.json();
    console.log("✅ Dados do usuário obtidos com sucesso");
    return data;

  } catch (error) {
    if (error.name === "AbortError") {
      console.log("⏰ Timeout ao obter dados do usuário");
    } else {
      console.log("💥 Erro ao conectar no servidor (ObD):", error.message);
    }

    // Em caso de erro de rede, tenta novamente apenas uma vez
    if (tentativas < 1) {
      console.log("🔄 Tentando novamente obter dados...");
      return await obterDadosUsuario(navigation, tentativas + 1);
    }

    return "false";
  }
}

export function roundTo2(value) {
  return Math.round(value * 100) / 100; // garante 2 casas
}

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
