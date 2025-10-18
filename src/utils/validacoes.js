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

// Validar tokens
export async function validarTokens(tentativas, navigation) {
  try {

    // Timeout 3s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    console.log('Tentativas: ' + tentativas);
    if (tentativas > 5) {
      console.log('Tentativas excedidas');
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      return 'false';
    }

    const tokens = await pegarTokens();
    const { accessToken, refreshToken } = tokens;

    if (!accessToken || !refreshToken) {
      console.log('Sem tokens');
      await limparTokens();
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      return 'false';
    }

    // 1. Valida accessToken
    let response = await fetch(LINKAPI + PORTAPI + "/token/validarToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        signal: controller.signal,
      },
    });

    clearTimeout(timeout);

    if (response.ok) {
      console.log('Token válido');
      return 'true';
    }

    // 2. Se expirado, tenta refresh
    if (refreshToken) {
      response = await fetch(LINKAPI + PORTAPI + "/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        await salvarTokens(data.accessToken, refreshToken);
        console.log('Token renovado');
        return 'true';
      } else {

        let data;
        try {
          console.log('Validando resposta');
          data = await response.json();
        } catch {
          console.log('Resposta inválida');
          data = {};
        }

        if (data.error && data.error === 'Usuário não autenticado') {
          console.log('Usuário não autenticado');
          await limparTokens();
          navigation.reset({
            index: 0,
            routes: [{ name: "login" }],
          });
          return 'false';
        }
        //console.log('Inciando nova tentiva');
        return await validarTokens(tentativas + 1, navigation);
      }
    }

    // 3. Se falhou
    console.log('Token Inválido');
    await limparTokens();
    navigation.reset({
      index: 0,
      routes: [{ name: "login" }],
    });
    return 'false';

  } catch (error) {
    if (error.name === "AbortError") {
      console.log('Servidor demorou a responder');
      return await validarTokens(tentativas + 1, navigation);
    } else {
      console.log('Erro ao conectar no servidor');
      return await validarTokens(tentativas + 1, navigation);
    }
  }
}

export async function obterDadosUsuario(navigation) {
  try {

    // Timeout 3s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    let tokens = await pegarTokens();
    let { accessToken, refreshToken } = tokens;

    if (!accessToken || !refreshToken) {
      console.log("Tokens ausentes");
      await limparTokens();
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      return 'false';
    }

    // 1. Tentando obter os dados
    let response = await fetch(LINKAPI + PORTAPI + "/usuarios/id", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        signal: controller.signal,
      },
    });

    clearTimeout(timeout);

    let data;

    if (!response.ok) {

      // 2. Se expirado, tenta refresh na função
      response = await validarTokens(0, navigation);

      if (response === 'false') {
        return 'false';
      } else if (response === 'true') {
        data = await obterDadosUsuario(navigation);
      }

      /*
      response = await fetch(LINKAPI + PORTAPI + "/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "Bearer " + refreshToken }),
      });

      if (response.ok) {
        data = await response.json();
        await salvarTokens(data.accessToken, refreshToken);
        console.log("Access Token: " + data.accessToken);
        console.log("Refresh Token: " + refreshToken);
        response = await fetch(LINKAPI + PORTAPI + "/usuarios/id", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${String(data.accessToken)}`,
          },
        });

        if (!response.ok) {
          console.log("Falha ao obter dados do usuário");
          await limparTokens();
          navigation.reset({
            index: 0,
            routes: [{ name: "login" }],
          });
          return;
        }

      } else {
        console.log("Falha ao renovar token");
        await limparTokens();
        navigation.reset({
          index: 0,
          routes: [{ name: "login" }],
        });
        return;
      }
      */
    } else {
      data = await response.json();
    }

    tokens = await pegarTokens();

    accessToken = tokens.accessToken;

    return data;
    /*
    const pesoFor = data.usuario.UsuarioPeso.replace('.', ',');
    const alturaFor = data.usuario.UsuarioAltura.replace('.', ',');

    setAltura(alturaFor);
    setPeso(pesoFor);
    setDtNascimento(new Date(data.usuario.UsuarioDtNascimento));
    setEmail(data.usuario.UsuarioEmail);
    setNome(data.usuario.UsuarioNome);
    setSexo(data.usuario.UsuarioSexo);
    */

  } catch {
    if (error.name === "AbortError") {
      console.log('Servidor demorou a responder (ObD)');
      return await validarTokens(0, navigation);
    } else {
      console.log('Erro ao conectar no servidor (ObD)');
      return await validarTokens(0, navigation);
    }
  }
}

export function roundTo2(value) {
  return Math.round(value * 100) / 100; // garante 2 casas
}

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
