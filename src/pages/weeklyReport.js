// weeklyReport.js

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ToastAndroid,
  Animated,
  Easing,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  parseISO as parseISO2,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";

import { LINKAPI, PORTAPI } from "../utils/global";
import {
  validarTokens,
  pegarTokens,
  obterDadosUsuario,
  roundTo2,
} from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

const screenWidth = Dimensions.get("window").width;

const calcularRegressaoLinear = (x, y) => {
  const n = x.length;
  if (n < 2) return null; // precisa de pelo menos 2 pontos

  const somaX = x.reduce((a, b) => a + b, 0);
  const somaY = y.reduce((a, b) => a + b, 0);
  const somaXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const somaX2 = x.reduce((a, b) => a + b * b, 0);

  const numeradorA = n * somaXY - somaX * somaY;
  const denominadorA = n * somaX2 - somaX * somaX;

  if (denominadorA === 0) return null; // evita divisão por zero

  const a = numeradorA / denominadorA;
  const b = somaY / n - a * (somaX / n);

  return { a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100 };
};


export default function WeeklyReportScreen({ navigation, route }) {
  const { codigo, nome } = route.params;

  // --- state ---
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [medicoes, setMedicoes] = useState([]); // Medições brutas (usadas apenas no modo semanal)
  const [erro, setErro] = useState("");
  const [expandedDay, setExpandedDay] = useState(null);
  const [expandedBlockKeys, setExpandedBlockKeys] = useState({});
  const [expandedHourKeys, setExpandedHourKeys] = useState({});
  const [modoGeral, setModoGeral] = useState(false);

  // Variáveis de estado para o peso e a porcentagem máxima
  const [pesoUsuario, setPesoUsuario] = useState(0);
  const [porcentagemMaxima, setPorcentagemMaxima] = useState(10); // Valor padrão

  // Estatísticas do período (NOVO)
  const [estatisticas, setEstatisticas] = useState(null);
  // 🟢 NOVO: Dados pré-agrupados no Relatório Geral (vindos da API)
  const [relatorioGeralAgrupado, setRelatorioGeralAgrupado] = useState([]);

  // Controle do bloco expansível de indicadores (NOVO)
  const [statsExpanded, setStatsExpanded] = useState(true);
  const animVal = useRef(new Animated.Value(1)).current; // 1 = aberto, 0 = fechado

  useEffect(() => {
    bucarDados();
  }, []);

  const bucarDados = async () => {
    try {
      const response = await obterDadosUsuario(navigation);
      if (response === "false") return;

      // Atualiza os estados com os dados do usuário
      // Utiliza fallback de 70kg e 10% caso os valores não existam
      setPesoUsuario(response.usuario.UsuarioPeso || 70);
      setPorcentagemMaxima(
        response.usuario.UsuarioPesoMaximoPorcentagem || 10
      );
    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
        console.log(error);
        navigation.reset({
          index: 0,
          routes: [{ name: "main" }],
        });
      }
    }
  };

  // Cálculo do limite máximo de peso
  const pesoMaximoPermitido = pesoUsuario * (porcentagemMaxima / 100);

  useEffect(() => {
    buscarRelatorioSemanal();
  }, [selectedWeek, modoGeral]);

  const handleWeekChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedWeek(date);
  };

  const buscarRelatorioSemanal = async () => {
    try {
      setLoading(true);
      setErro("");
      setMedicoes([]);
      setEstatisticas(null);
      setRelatorioGeralAgrupado([]); // 🟢 Limpa o estado no início

      const resposta = await validarTokens(0, navigation);
      if (resposta !== "true") {
        if (resposta === "false") return;
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

      const tokens = await pegarTokens();
      const { accessToken } = tokens;

      let url = "";

      if (modoGeral) {
        // 🔹 Modo Relatório Geral → usa a rota geral otimizada
        url = `${LINKAPI}${PORTAPI}/medicoes/geral/${codigo}`;
      } else {
        // 🔹 Modo Semana Selecionada → usa a nova rota /periodo/:inicio/:fim/:mochila
        const inicio = format(
          startOfWeek(selectedWeek, { locale: ptBR }),
          "yyyy-MM-dd"
        );
        const fim = format(
          endOfWeek(selectedWeek, { locale: ptBR }),
          "yyyy-MM-dd"
        );

        url = `${LINKAPI}${PORTAPI}/medicoes/periodo/${inicio}/${fim}/${codigo}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const erroData = await response.json();
        setErro(erroData.error || "Erro ao obter relatório semanal");
        return;
      }

      const dados = await response.json();

      if (modoGeral) {
        // 🟢 NOVO: Consome os dados pré-processados da API para o Relatório Geral
        setMedicoes([]); // Não precisamos dos dados brutos
        setEstatisticas(dados.estatisticas || null);
        setRelatorioGeralAgrupado(dados.agrupadoPorDia || []); // Contém os dados para o gráfico
      } else {
        // 🔹 Modo Semana Selecionada: Mantém o processamento local (necessário para detalhes)
        setMedicoes(dados || []);
        setRelatorioGeralAgrupado([]); // Não usamos o agrupamento geral neste modo

        // --- Cálculo local de indicadores estatísticos para o período selecionado ---
        const minuteMap = {};
        (dados || []).forEach((m) => {
          try {
            const dt = new Date(m.MedicaoData);
            const hh = String(dt.getHours()).padStart(2, "0");
            const mm = String(dt.getMinutes()).padStart(2, "0");
            const key = `${hh}:${mm}`;
            if (!minuteMap[key]) minuteMap[key] = { left: [], right: [], raw: [] };

            const local = (m.MedicaoLocal || "").toString().toLowerCase();
            if (local.includes("esquer")) minuteMap[key].left.push(Number(m.MedicaoPeso || 0));
            else if (local.includes("direit")) minuteMap[key].right.push(Number(m.MedicaoPeso || 0));
            else if (local.includes("amb") || local.includes("cent")) {
              minuteMap[key].left.push(Number(m.MedicaoPeso || 0));
              minuteMap[key].right.push(Number(m.MedicaoPeso || 0));
            } else minuteMap[key].raw.push(Number(m.MedicaoPeso || 0));
          } catch (e) {
            // ignore malformed dates
          }
        });

        const totals = Object.keys(minuteMap).map((k) => {
          const obj = minuteMap[k];
          const avgLeft = obj.left.length ? obj.left.reduce((a, b) => a + b, 0) / obj.left.length : 0;
          const avgRight = obj.right.length ? obj.right.reduce((a, b) => a + b, 0) / obj.right.length : 0;
          return roundTo2((avgLeft || 0) + (avgRight || 0));
        });

        const stats = calcularEstatisticas(totals);

        // --- Cálculo da regressão linear ---
        const x = []; // eixo X → índices (1, 2, 3, 4, ...)
        const y = []; // eixo Y → médias válidas

        totals.forEach((valor, i) => {
          if (valor > 0 && Number.isFinite(valor)) {
            x.push(i + 1);
            y.push(valor);
          }
        });

        let regressao = null;
        if (x.length >= 2) {
          regressao = calcularRegressaoLinear(x, y);
        }

        setEstatisticas({
          ...stats,
          regressao,
        });
      }


    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const localSide = (local) => {
    if (!local) return "outro";
    const l = local.toString().toLowerCase();
    if (l.includes("esquer") || l.includes("esq")) return "esquerda";
    if (l.includes("direit") || l.includes("dir")) return "direita";
    // 'ambos' or 'centro' -> treat both sides
    if (l.includes("amb") || l.includes("cent")) return "ambos";
    return "outro";
  };

  // --- Função calcularEstatisticas (copiada/adaptada do relatório diário)
  const calcularEstatisticas = (valoresRaw) => {
    const valores = valoresRaw.filter((v) => typeof v === "number" && !isNaN(v));
    if (!valores.length) return null;

    const n = valores.length;
    const somatorio = valores.reduce((a, b) => a + b, 0);
    const media = somatorio / n;

    const sorted = [...valores].sort((a, b) => a - b);
    const mediana = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    // Moda (pode haver mais de uma) — agrupar por valor arredondado a 2 decimais
    const freq = {};
    valores.forEach((v) => {
      const key = roundTo2(v).toString();
      freq[key] = (freq[key] || 0) + 1;
    });
    const maxFreq = Math.max(...Object.values(freq));
    const modaArray = Object.keys(freq).filter((k) => freq[k] === maxFreq).map((k) => Number(k));

    // Variância (populacional) e desvio padrão
    const variancia = valores.reduce((a, b) => a + Math.pow(b - media, 2), 0) / n;
    const desvioPadrao = Math.sqrt(variancia);

    // Prevenir divisão por zero ao calcular assimetria/curtose
    const denomSkew = desvioPadrao === 0 ? 1 : Math.pow(desvioPadrao, 3);
    const denomKurt = desvioPadrao === 0 ? 1 : Math.pow(desvioPadrao, 4);

    const assimetria = (valores.reduce((a, b) => a + Math.pow(b - media, 3), 0) / n) / denomSkew;
    const curtose = (valores.reduce((a, b) => a + Math.pow(b - media, 4), 0) / n) / denomKurt - 3;

    return {
      media: roundTo2(media),
      mediana: roundTo2(mediana),
      moda: modaArray.length ? modaArray.join(", ") : "—",
      desvioPadrao: roundTo2(desvioPadrao),
      assimetria: roundTo2(assimetria),
      curtose: roundTo2(curtose),
      totalMedicoes: n,
      totalPeso: roundTo2(somatorio),
    };
  };

  const groupByDaySorted = (lista) => {
    const map = {};
    lista.forEach((m) => {
      const dt = new Date(m.MedicaoData);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(m);
    });

    const sortedKeys = Object.keys(map).sort();

    return sortedKeys.map((k) => {
      const d = new Date(k + "T00:00:00");
      const label = format(d, "EEEE, dd/MM", { locale: ptBR });
      map[k].sort((a, b) => new Date(a.MedicaoData) - new Date(b.MedicaoData));
      return { dateKey: k, label, items: map[k] };
    });
  };

  // Função buildDayDetails (mantida, mas só será usada no modo Semana Selecionada)
  const buildDayDetails = (items) => {
    const minuteMap = {};
    items.forEach((m) => {
      const dt = new Date(m.MedicaoData);
      const hh = String(dt.getHours()).padStart(2, "0");
      const mm = String(dt.getMinutes()).padStart(2, "0");
      const minuteKey = `${hh}:${mm}`;
      if (!minuteMap[minuteKey]) minuteMap[minuteKey] = { left: [], right: [], other: [], raw: [] };
      const side = localSide(m.MedicaoLocal);
      if (side === "esquerda") minuteMap[minuteKey].left.push(Number(m.MedicaoPeso || 0));
      else if (side === "direita") minuteMap[minuteKey].right.push(Number(m.MedicaoPeso || 0));
      else if (side === "ambos") {
        minuteMap[minuteKey].left.push(Number(m.MedicaoPeso || 0));
        minuteMap[minuteKey].right.push(Number(m.MedicaoPeso || 0));
      } else {
        minuteMap[minuteKey].other.push(Number(m.MedicaoPeso || 0));
      }
      minuteMap[minuteKey].raw.push(m);
    });

    const minuteKeys = Object.keys(minuteMap).sort((a, b) => {
      const [hA, mA] = a.split(":").map(Number);
      const [hB, mB] = b.split(":").map(Number);
      return hA === hB ? mA - mB : hA - hB;
    });

    const minuteEntries = minuteKeys.map((key) => {
      const obj = minuteMap[key];
      const avgLeft =
        obj.left.length > 0 ? obj.left.reduce((a, b) => a + b, 0) / obj.left.length : 0;
      const avgRight =
        obj.right.length > 0 ? obj.right.reduce((a, b) => a + b, 0) / obj.right.length : 0;
      const total = avgLeft + avgRight;

      return {
        minute: key,
        avgLeft: parseFloat(avgLeft.toFixed(2)),
        avgRight: parseFloat(avgRight.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        raw: obj.raw,
      };
    });


    const blocks = {};
    minuteEntries.forEach((me) => {
      const [hh, mm] = me.minute.split(":").map(Number);
      const blockStart = Math.floor(hh / 3) * 3;
      const hourKey = String(hh).padStart(2, "0");
      if (!blocks[blockStart]) blocks[blockStart] = { start: blockStart, end: blockStart + 3, hours: {}, minutes: [] };
      if (!blocks[blockStart].hours[hourKey]) blocks[blockStart].hours[hourKey] = [];
      blocks[blockStart].hours[hourKey].push(me);
      blocks[blockStart].minutes.push(me);
    });

    Object.keys(blocks).forEach((bk) => {
      const b = blocks[bk];
      const count = b.minutes.length;
      const sum = b.minutes.reduce((acc, m) => acc + (Number(m.total) || 0), 0);
      b.blockMinutesCount = count;
      b.blockSumTotal = parseFloat(sum.toFixed(2));
      b.blockAvgTotal = parseFloat((count > 0 ? sum / count : 0).toFixed(2));
      const hourKeys = Object.keys(b.hours).sort((a, b) => Number(a) - Number(b));
      const hoursSorted = {};
      hourKeys.forEach(hk => {
        hoursSorted[hk] = b.hours[hk].sort((x, y) => {
          const [hA, mA] = x.minute.split(":").map(Number);
          const [hB, mB] = y.minute.split(":").map(Number);
          if (hA === hB) return mA - mB;
          return hA - hB;
        });
      });
      b.hours = hoursSorted;
    });

    const dayMinutesCount = minuteEntries.length;
    const daySumTotal = minuteEntries.reduce((acc, m) => acc + (Number(m.total) || 0), 0);
    const dayAvgTotal = parseFloat((dayMinutesCount > 0 ? daySumTotal / dayMinutesCount : 0).toFixed(2));

    return {
      minuteEntries,
      blocks,
      daySumTotal: parseFloat(daySumTotal.toFixed(2)),
      dayAvgTotal,
    };
  };

  // 🟢 NOVO: Usa os dados pré-processados da API quando em modoGeral
  // 🟢 CORREÇÃO: Função para construir os grupos da UI
  const buildGroupsForUI = () => {
    if (modoGeral) {
      if (!relatorioGeralAgrupado.length) return [];

      // 🔹 Agrupa por key para evitar duplicatas (problema identificado nos logs)
      const groupedByKey = {};
      relatorioGeralAgrupado.forEach(g => {
        if (!groupedByKey[g.key]) {
          groupedByKey[g.key] = g;
        }
      });

      // 🔹 Ordena os dias da semana corretamente
      const diasOrdenados = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
      return diasOrdenados
        .filter(dia => groupedByKey[dia])
        .map(dia => ({
          key: groupedByKey[dia].key,
          label: groupedByKey[dia].label,
          mediaPeso: groupedByKey[dia].mediaPeso,
          details: {
            dayAvgTotal: groupedByKey[dia].mediaPeso || 0
          }
        }));
    } else {
      // 🔹 Modo Semana Selecionada: Mantém o processamento local
      const filtered = medicoes.filter((m) =>
        isWithinInterval(parseISO(m.MedicaoData), {
          start: startOfWeek(selectedWeek, { locale: ptBR }),
          end: endOfWeek(selectedWeek, { locale: ptBR }),
        })
      );
      const days = groupByDaySorted(filtered);
      return days.map(d => {
        const details = buildDayDetails(d.items);
        return { key: d.dateKey, label: d.label, items: d.items, details };
      });
    }
  };

  const groupsForUI = buildGroupsForUI();

  // 🟢 CORREÇÃO: Geração dos labels do gráfico
  const chartLabels = groupsForUI.map(g => {
    if (modoGeral) {
      // No modo geral, pega as 3 primeiras letras do dia da semana
      return g.label.split("-")[0].slice(0, 3); // "segunda-feira" -> "seg"
    } else {
      // No modo semanal, mantém a lógica original
      return g.label.split(",")[0].slice(0, 3);
    }
  });

  // 🟢 CORREÇÃO: Geração dos valores do gráfico
  const chartValues = groupsForUI.map(g => {
    if (modoGeral) {
      // No modo geral, usa mediaPeso diretamente
      return g.mediaPeso || 0;
    } else {
      // No modo semanal, usa dayAvgTotal
      return g.details?.dayAvgTotal || 0;
    }
  });

  // 🟢 CORREÇÃO: Construção dos dados do gráfico
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        data: chartValues,
        color: () => "#43a047",
        strokeWidth: 2,
      },
    ],
    legend: [modoGeral ? "Média Geral por Dia" : "Média Total Diária"],
  };

  const toggleBlock = (dayKey, blockStart) => {
    const k = `${dayKey}|${blockStart}`;
    setExpandedBlockKeys(prev => ({ ...prev, [k]: !prev[k] }));
  };
  const toggleHour = (dayKey, hour) => {
    const k = `${dayKey}|${hour}`;
    setExpandedHourKeys(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const hasValidChart = chartValues.length > 0 && chartValues.some(v => v > 0);

  const toggleStats = () => {
    const toValue = statsExpanded ? 0 : 1;
    Animated.timing(animVal, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    setStatsExpanded(!statsExpanded);
  };

  const animatedHeight = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140], // altura do bloco (ajuste se precisar)
  });
  const animatedOpacity = animVal;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#3A3A3A" />
        </TouchableOpacity>

        <Text style={styles.title}>Relatório Semanal</Text>
        <Text style={styles.subtitle}>{"\n"}{nome}{"\n"}({codigo})</Text>

        <View style={styles.modeButtons}>
          <TouchableOpacity style={[styles.modeButton, !modoGeral && styles.modeButtonActive]} onPress={() => setModoGeral(false)}>
            <Text style={[styles.modeButtonText, !modoGeral && styles.modeButtonTextActive]}>📅 Semana Selecionada</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, modoGeral && styles.modeButtonActive]} onPress={() => setModoGeral(true)}>
            <Text style={[styles.modeButtonText, modoGeral && styles.modeButtonTextActive]}>📊 Relatório Geral</Text>
          </TouchableOpacity>
        </View>

        {!modoGeral && (
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>
              📆 Semana de {format(startOfWeek(selectedWeek, { locale: ptBR }), "dd/MM")} até {format(endOfWeek(selectedWeek, { locale: ptBR }), "dd/MM")}
            </Text>
          </TouchableOpacity>
        )}

        {showDatePicker && (
          <DateTimePicker value={selectedWeek} mode="date" display="default" onChange={handleWeekChange} />
        )}

        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#0000ff" /><Text>Carregando...</Text></View>
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : (!modoGeral && medicoes.length === 0) || (modoGeral && relatorioGeralAgrupado.length === 0) ? (
          <Text style={styles.infoText}>Nenhuma medição encontrada.</Text>
        ) : (
          <>
            {/* --- BLOCO DE INDICADORES --- */}
            <View style={styles.statsOuter}>
              <TouchableOpacity style={styles.statsHeader} onPress={toggleStats} activeOpacity={0.8}>
                <Text style={styles.statsHeaderText}>📈 Indicadores Estatísticos</Text>
                <Text style={styles.statsHeaderToggle}>{statsExpanded ? "Ocultar" : "Mostrar"}</Text>
              </TouchableOpacity>

              <Animated.View style={[styles.statsAnimated, { height: animatedHeight, opacity: animatedOpacity }]}>
                <ScrollView horizontal contentContainerStyle={styles.statsGrid} showsHorizontalScrollIndicator={false}>
                  <View style={[styles.statCard, { borderLeftColor: "#4c8bafff" }]}>
                    <Text style={styles.statCardTitle}>Total Medições</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.totalMedicoes ?? "—"}</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#af4c4cff" }]}>
                    <Text style={styles.statCardTitle}>Total Peso</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.totalPeso ?? "—"} kg</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#4CAF50" }]}>
                    <Text style={styles.statCardTitle}>Média</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.media ?? "—"} kg</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#2196F3" }]}>
                    <Text style={styles.statCardTitle}>Mediana</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.mediana ?? "—"} kg</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#9C27B0" }]}>
                    <Text style={styles.statCardTitle}>Moda</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.moda ?? "—"} kg</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#FF9800" }]}>
                    <Text style={styles.statCardTitle}>Desvio Padrão</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.desvioPadrao ?? "—"} kg</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#F44336" }]}>
                    <Text style={styles.statCardTitle}>Assimetria</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.assimetria ?? "—"}</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#607D8B" }]}>
                    <Text style={styles.statCardTitle}>Curtose</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.curtose ?? "—"}</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: "#607D8B" }]}>
                    <Text style={styles.statCardTitle}>Regressão Linear</Text>
                    <Text style={styles.statCardValue}>{estatisticas?.regressao
                      ? `y = ${estatisticas.regressao.a}x + ${estatisticas.regressao.b}`
                      : "-"}</Text>
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
            {/* --- FIM BLOCO DE INDICADORES --- */}

            <Text style={styles.graphTitle}>{modoGeral ? "\n📊 Média Semanal por Dia\n(Todas as semanas)" : "\n📊 Média Total Diária\n(Semana Selecionada)"}</Text>

            {hasValidChart ? (
              <LineChart
                data={chartData} // <-- Usa a variável chartData definida condicionalmente
                width={screenWidth - 20}
                height={220}
                yAxisSuffix=" kg"
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#eee",
                  backgroundGradientTo: "#eee",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(0, 88, 136, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  fillShadowGradient: "#43a047",
                  fillShadowGradientOpacity: 0.5,
                }}
                style={styles.graph}
                bezier
                fromZero
                onDataPointClick={(d) => {
                  if (!modoGeral) {
                    const idx = d.index;
                    const g = groupsForUI[idx];
                    if (g) setExpandedDay(expandedDay === g.key ? null : g.key);
                  }
                }}
              />

            ) : (
              <Text style={styles.infoText}>Nenhum dado disponível para este filtro.</Text>
            )}

            {/* --- GRÁFICO 2: Comparativo Esquerda x Direita --- */}
            {/* 🎯 SÓ RENDERIZA QUANDO NÃO ESTIVER NO MODO GERAL */}
            {hasValidChart && !modoGeral && (
              <>
                <Text style={[styles.graphTitle, { marginTop: 25 }]}>
                  ⚖️ Comparativo Esquerda x Direita{"\n"}
                  (Semana Selecionada) {/* Removido o texto "Relatório Geral" aqui */}
                </Text>

                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [
                      {
                        data: groupsForUI.map((g) => {
                          const details = g.details;
                          // Esta lógica continua dependendo de 'details.minuteEntries' e só funciona no modo detalhado.
                          if (!details || !details.minuteEntries?.length) return 0;

                          // média das medições do lado esquerdo
                          const leftVals = details.minuteEntries
                            .map((m) => m.avgLeft)
                            .filter((n) => !isNaN(n) && n > 0);
                          return leftVals.length
                            ? leftVals.reduce((a, b) => a + b, 0) / leftVals.length
                            : 0;
                        }),
                        color: () => "#42be42ff", // Azul: Esquerda
                        strokeWidth: 2,
                      },
                      {
                        data: groupsForUI.map((g) => {
                          const details = g.details;
                          if (!details || !details.minuteEntries?.length) return 0;

                          // média das medições do lado direito
                          const rightVals = details.minuteEntries
                            .map((m) => m.avgRight)
                            .filter((n) => !isNaN(n) && n > 0);
                          return rightVals.length
                            ? rightVals.reduce((a, b) => a + b, 0) / rightVals.length
                            : 0;
                        }),
                        color: () => "#43a047", // Verde: Direita
                        strokeWidth: 2,
                      },
                    ],
                    legend: ["Esquerda", "Direita"], // 🏷️ Legenda
                  }}
                  width={screenWidth - 20}
                  height={180}
                  yAxisSuffix=" kg"
                  chartConfig={{
                    backgroundColor: "#fff",
                    backgroundGradientFrom: "#eee",
                    backgroundGradientTo: "#eee",
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    propsForDots: { r: "4", strokeWidth: "2" },
                    propsForBackgroundLines: { strokeDasharray: "3" },
                  }}
                  style={[styles.graph, { marginBottom: 20 }]}
                  bezier
                  fromZero
                />
              </>
            )}

            {/* 🛑 AQUI SÓ SERÁ RENDERIZADO NO MODO SEMANA SELECIONADA, CONFORME REQUISITADO */}
            {!modoGeral && groupsForUI.map((g) => (
              <View key={g.key} style={styles.blockContainer}>
                <TouchableOpacity style={[styles.blockHeader, expandedDay === g.key && styles.blockHeaderExpanded]} onPress={() => setExpandedDay(expandedDay === g.key ? null : g.key)}>
                  <Text style={styles.blockTitle}>{g.label}</Text>
                  <Text style={styles.blockToggle}>{expandedDay === g.key ? "▼" : "▶"}</Text>
                </TouchableOpacity>

                {expandedDay === g.key && (
                  <>
                    <View style={{ padding: 10, backgroundColor: "#e8f6f6", marginHorizontal: 10, borderRadius: 8 }}>
                      <Text style={{ fontWeight: "700", color: "#00695c" }}>Média do dia (média dos totais por minuto): {g.details.dayAvgTotal.toFixed(2)} kg</Text>
                    </View>

                    {Object.keys(g.details.blocks).map(bk => Number(bk)).sort((a, b) => a - b).map(blockStart => {
                      const block = g.details.blocks[blockStart];
                      const blockKey = `${g.key}|${blockStart}`;
                      const isBlockOpen = !!expandedBlockKeys[blockKey];
                      return (
                        <View key={blockStart} style={styles.subBlock}>
                          <TouchableOpacity style={[styles.subBlockHeader, isBlockOpen && styles.subBlockHeaderExpanded]} onPress={() => toggleBlock(g.key, blockStart)}>
                            <Text style={styles.subBlockTitle}>{String(blockStart).padStart(2, '0')}:00 - {String(blockStart + 3).padStart(2, '0')}:00</Text>
                            <Text style={styles.blockToggle}>{isBlockOpen ? "▼" : "▶"}</Text>
                          </TouchableOpacity>

                          {isBlockOpen && (
                            <>
                              {Object.keys(block.hours).map(hk => Number(hk)).sort((a, b) => a - b).map(hourNum => {
                                const hourKey = `${g.key}|${String(hourNum).padStart(2, '0')}`;
                                const isHourOpen = !!expandedHourKeys[hourKey];
                                const hourEntries = block.hours[String(hourNum).padStart(2, '0')];

                                const hourSum = hourEntries.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
                                const hourAvg = hourEntries.length ? (hourSum / hourEntries.length) : 0;

                                return (
                                  <View key={hourNum} style={{ marginHorizontal: 10, marginTop: 8 }}>
                                    <TouchableOpacity style={[styles.hourHeader, isHourOpen && styles.hourHeaderExpanded]} onPress={() => toggleHour(g.key, String(hourNum).padStart(2, '0'))}>
                                      <Text style={styles.hourTitle}>{String(hourNum).padStart(2, '0')}:00</Text>
                                      <Text style={styles.blockToggle}>{isHourOpen ? "▼" : "▶"}</Text>
                                    </TouchableOpacity>

                                    {isHourOpen && (
                                      <View style={{ paddingLeft: 10, paddingTop: 6 }}>
                                        {hourEntries.map((minuteEntry, mi) => {

                                          // 🛑 Lógica de verificação de alerta com base no peso máximo permitido
                                          const pesoTotalDoMinuto = minuteEntry.avgLeft + minuteEntry.avgRight;
                                          const isAlert = pesoTotalDoMinuto > pesoMaximoPermitido;

                                          return (
                                            <View key={minuteEntry.minute + mi} style={[styles.card, isAlert && styles.alertCard]}>

                                              <View style={styles.cardHeader}>
                                                <Text style={styles.cardTime}>{minuteEntry.minute}</Text>

                                                {/* Lógica de equilíbrio inspirada no Relatório Diário */}
                                                {(() => {
                                                  const pesoEsq = minuteEntry.avgLeft;
                                                  const pesoDir = minuteEntry.avgRight;

                                                  const diferenca = Math.abs(pesoEsq - pesoDir);
                                                  const maiorPeso = Math.max(pesoEsq, pesoDir);
                                                  const percentual = maiorPeso > 0 ? (diferenca / maiorPeso) * 100 : 0;

                                                  let posicao = "center";
                                                  let cor = "#42be42ff"; // Azul

                                                  // Se o desequilíbrio for maior que 5%
                                                  if (percentual > 5) {
                                                    if (pesoEsq > pesoDir) {
                                                      posicao = "flex-start"; // Ponto mais à esquerda (Peso Esquerdo maior)
                                                    } else {
                                                      posicao = "flex-end"; // Ponto mais à direita (Peso Direito maior)
                                                    }
                                                    cor = "red"; // Vermelho
                                                  }

                                                  return (
                                                    <View
                                                      style={[
                                                        styles.balanceLine,
                                                        { justifyContent: posicao, backgroundColor: cor },
                                                      ]}
                                                    >
                                                      <View style={styles.balanceDot} />
                                                    </View>
                                                  );
                                                })()}

                                              </View>

                                              <View style={styles.ladoContainer}>
                                                <Text style={styles.cardText}><Text style={styles.bold}>Esquerda:</Text> {minuteEntry.avgLeft.toFixed(2)} kg</Text>
                                                <Text style={styles.cardText}><Text style={styles.bold}>Direita:</Text> {minuteEntry.avgRight.toFixed(2)} kg</Text>
                                              </View>

                                              <Text style={[styles.cardText, { marginTop: 6 }]}><Text style={styles.bold}>Total:</Text> {minuteEntry.total.toFixed(2)} kg</Text>

                                              {isAlert && (
                                                <Text style={styles.alertText}>⚠️ Peso Excedido!</Text>
                                              )}
                                            </View>
                                          );
                                        })}
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            ))}

          </>
        )}
      </ScrollView>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} onToggleTheme={() => setDarkTheme(!darkTheme)} isDarkTheme={darkTheme} onLogout={() => { setSettingsVisible(false); navigation.reset({ index: 0, routes: [{ name: "Login" }] }); }} />

      <View style={styles.bottomContainer}>
        <BottomNav navigation={navigation} onOpenSettings={() => setSettingsVisible(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eee" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3A3A3A",
    textAlign: "center",
    marginTop: 60,
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  modeButtons: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
  },
  modeButton: {
    backgroundColor: "#cfd8dc",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: "#2e7d32",
  },
  modeButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: "#fff",
  },
  dateButton: {
    alignSelf: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#9dadaf",
    marginBottom: 15,
  },
  dateButtonText: { fontSize: 16, color: "#333" },
  loadingContainer: { alignItems: "center", marginTop: 30 },
  errorText: { color: "red", textAlign: "center", marginTop: 20, fontSize: 16 },
  infoText: { textAlign: "center", color: "#555", marginTop: 40, fontSize: 15 },
  graphTitle: { fontSize: 18, textAlign: "center", marginBottom: 10, color: "#333" },
  graph: { alignSelf: "center", borderRadius: 10 },
  blockContainer: {
    marginHorizontal: 10,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
    elevation: 2,
    overflow: "hidden",
  },
  blockHeader: {
    backgroundColor: "#e0f2f1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  blockTitle: { fontSize: 16, fontWeight: "600", color: "#00695c" },
  blockToggle: { fontSize: 18, color: "#004d40" },
  blockHeaderExpanded: { backgroundColor: "#b2dfdb" },
  subBlock: {
    marginTop: 6,
    backgroundColor: "#f1f8e9",
    borderRadius: 10,
    marginHorizontal: 10,
    paddingBottom: 8,
  },
  subBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#dcedc8",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  subBlockHeaderExpanded: { backgroundColor: "#c5e1a5" },
  subBlockTitle: { fontSize: 15, fontWeight: "500", color: "#33691e" },
  hourHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  hourHeaderExpanded: { backgroundColor: "#f5f5f5" },
  hourTitle: { fontSize: 14, fontWeight: "600", color: "#2e7d32" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#b0bec5",
  },
  // 🛑 NOVO ESTILO PARA ALERTA NO CARD
  alertCard: {
    borderColor: "#d32f2f", // Cor vermelha para a borda
    backgroundColor: "#ffebee", // Fundo levemente avermelhado
    borderWidth: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTime: { fontSize: 15, fontWeight: "bold", color: "#0288d1" },
  balanceLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2196F3",
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    width: 80,
  },
  balanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    marginHorizontal: 2,
  },
  ladoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardText: { fontSize: 15, color: "#333", marginTop: 5 },
  bold: { fontWeight: "bold" },
  // 🛑 NOVO ESTILO PARA O TEXTO DE ALERTA
  alertText: {
    color: "#c62828",
    fontWeight: "bold",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#d32f2f",
    paddingTop: 5,
  },
  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  backButton: { position: "absolute", top: 40, left: 20 },

  // ======= ESTILOS DOS INDICADORES (ADICIONADOS) =======
  statsOuter: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d0d7d7",
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#e8f5e9",
  },
  statsHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2e7d32",
  },
  statsHeaderToggle: {
    fontSize: 14,
    color: "#2e7d32",
  },
  statsAnimated: {
    // height controlado pela animação
    paddingVertical: 8,
  },
  statsGrid: {
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statCard: {
    backgroundColor: "#fff",
    minWidth: 150,           // 🔹 largura mínima, mas permite crescer
    maxWidth: 1000,           // 🔹 limite opcional (pode ajustar)
    marginRight: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 2,
    borderLeftWidth: 6,
    borderLeftColor: "#4CAF50",
    flexShrink: 0,           // 🔹 impede que o card reduza tamanho
  },
  statCardTitle: {
    fontSize: 13,
    color: "#333",
    fontWeight: "600",
    marginBottom: 6,
  },
  statCardValue: {
    fontSize: 16,
    color: "#111",
    fontWeight: "700",
  },
  // ======= FIM ESTILOS DOS INDICADORES =======
});