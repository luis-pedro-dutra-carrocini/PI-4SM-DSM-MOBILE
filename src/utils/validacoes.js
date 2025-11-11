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

// utils/validacoes.js - Função validarTokens corrigida
export async function validarTokens(tentativas = 0, navigation) {
  try {
    console.log("🔁 Tentativas de validação:", tentativas);

    // 🔒 Limite mais restritivo
    if (tentativas >= 2) {
      console.log("🚫 Tentativas excedidas - Servidor offline?");
      return "offline";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const { accessToken, refreshToken } = await pegarTokens();

    if (!accessToken || !refreshToken) {
      console.log("⚠️ Tokens ausentes");
      await limparTokens();
      if (navigation) {
        navigation.reset({
          index: 0,
          routes: [{ name: "login" }],
        });
      }
      return "false";
    }

    // 🧠 Tenta validar o accessToken
    let response = await fetch(LINKAPI + PORTAPI + "/token/validarToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // ✅ CORREÇÃO: Verifica corretamente o status 200
    if (response.status === 200) {
      const data = await response.json();
      if (data.ok === true) {
        console.log("✅ Token válido");
        return "true";
      } else {
        console.log("⚠️ Resposta inesperada na validação:", data);
        return "offline";
      }
    }

    // ❌ Token inválido ou expirado (401)
    if (response.status === 401) {
      console.log("🔄 Token expirado, tentando renovar...");

      // Tenta renovar com refreshToken
      const refreshResponse = await fetch(LINKAPI + PORTAPI + "/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: refreshToken }),
      });

      if (refreshResponse.status === 200) {
        const refreshData = await refreshResponse.json();
        await salvarTokens(refreshData.accessToken, refreshToken);
        console.log("🔄 Token renovado com sucesso");
        return "true";
      }

      // ❌ Refresh token também inválido
      if (refreshResponse.status === 401) {
        console.log("🚫 Refresh token inválido");
        await limparTokens();
        if (navigation) {
          navigation.reset({
            index: 0,
            routes: [{ name: "login" }],
          });
        }
        return "false";
      }

      // 🔄 Outro erro no refresh
      console.log("⚠️ Erro ao renovar token:", refreshResponse.status);
      return "offline";
    }

    // 🔄 Outros erros HTTP - não limpa tokens
    console.log(`⚠️ Erro ${response.status} ao validar token`);
    return "offline";

  } catch (error) {
    if (error.name === "AbortError") {
      console.log("⏰ Timeout ao validar token");
    } else {
      console.log("💥 Erro de conexão:", error.message);
    }

    if (tentativas < 1) {
      await new Promise(res => setTimeout(res, 2000));
      return await validarTokens(tentativas + 1, navigation);
    }

    return "offline";
  }
}

export async function obterDadosUsuario(navigation, tentativas = 0) {
  try {
    console.log("📡 Tentando obter dados do usuário (tentativa", tentativas + 1, ")");

    // 🔒 Limite de tentativas - CORRIGIDO
    if (tentativas >= 3) { // Aumentei para 3 tentativas
      console.log("🚫 Tentativas máximas - servidor pode estar offline");
      return "offline";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const { accessToken, refreshToken } = await pegarTokens();

    if (!accessToken || !refreshToken) {
      console.log("⚠️ Tokens ausentes ao obter dados");
      await limparTokens();
      if (navigation) {
        navigation.reset({
          index: 0,
          routes: [{ name: "login" }],
        });
      }
      return "false";
    }

    // 🔐 Tenta obter os dados com o token atual
    let response = await fetch(LINKAPI + PORTAPI + "/usuarios/id", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // ✅ Sucesso - retorna os dados do usuário
    if (response.status === 200) {
      const data = await response.json();
      console.log("✅ Dados do usuário obtidos com sucesso");
      return data;
    }

    // ❌ Token expirado (401) - tenta renovar
    if (response.status === 401) {
      console.log("⚠️ Token expirado ao obter dados, validando...");

      const validado = await validarTokens(0, navigation);

      if (validado === "true") {
        // Token foi renovado, tenta novamente APENAS UMA VEZ
        console.log("🔄 Token renovado, tentando obter dados novamente...");
        return await obterDadosUsuario(navigation, tentativas + 1);
      } else {
        return validado; // "false" ou "offline"
      }
    }

    // 🔄 Erro 404 ou outros - NÃO tenta novamente automaticamente
    console.log(`⚠️ Erro ${response.status} ao obter dados`);

    // Se for 404, o endpoint pode não existir
    if (response.status === 404) {
      return "endpoint_nao_encontrado";
    }

    return "erro_servidor";

  } catch (error) {
    // 🔄 Erros de rede - tenta novamente
    if (error.name === "AbortError") {
      console.log("⏰ Timeout ao obter dados do usuário");
    } else {
      console.log("💥 Erro de conexão (ObD):", error.message);
    }

    // Tenta novamente apenas se for erro de rede
    if (tentativas < 2) {
      console.log("🔄 Tentando novamente obter dados...");
      await new Promise(res => setTimeout(res, 2000));
      return await obterDadosUsuario(navigation, tentativas + 1);
    }

    return "offline";
  }
}

export function roundTo2(value) {
  return Math.round(value * 100) / 100; // garante 2 casas
}

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
