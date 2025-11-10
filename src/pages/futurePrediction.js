// futurePrediction.js.

import React, { useState, useEffect, useRef } from "react";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { Dimensions } from "react-native";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";

import { LINKAPI, PORTAPI } from "../utils/global";
import { validarTokens, pegarTokens, obterDadosUsuario } from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

const screenWidth = Dimensions.get("window").width;

export default function FuturePredictionScreen({ navigation, route }) {
  const { codigo, nome } = route.params;

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [resultadoPrevisao, setResultadoPrevisao] = useState(null);
  const [motivoNaoCalcular, setMotivoNaoCalcular] = useState("");
  const [estatisticas, setEstatisticas] = useState(null);

  // controle de bloco expansível
  const [statsExpanded, setStatsExpanded] = useState(true);
  const animVal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    bucarDadosUsuario();
  }, []);

  const bucarDadosUsuario = async () => {
    try {
      const response = await obterDadosUsuario(navigation);
      if (response === "false") return;
    } catch (e) {

    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

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
    outputRange: [0, 140],
  });
  const animatedOpacity = animVal;

  // 🟢 NOVA FUNÇÃO: Busca previsão calculada pela API
  const calcularPrevisaoPorDiaSemana = async () => {
    try {
      setLoading(true);
      setErro("");
      setResultadoPrevisao(null);
      setMotivoNaoCalcular("");
      setEstatisticas(null);

      const resposta = await validarTokens(0, navigation);
      if (resposta !== "true") {
        if (resposta === "false") return;
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

      const tokens = await pegarTokens();
      const { accessToken } = tokens;

      // Formata a data para YYYY-MM-DD
      const dataFormatada = format(selectedDate, "yyyy-MM-dd");

      const response = await fetch(
        `${LINKAPI}${PORTAPI}/medicoes/previsao/${codigo}/${dataFormatada}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErro(data.error || "Erro ao calcular previsão");
        return;
      }

      const dados = await response.json();

      if (dados.error) {
        setErro(dados.error);
        return;
      }

      // 🟢 AGORA A API JÁ RETORNA TUDO PRÉ-CALCULADO
      setEstatisticas(dados.estatisticas);
      
      if (dados.previsao) {
        setResultadoPrevisao(dados.previsao);
      } else {
        setMotivoNaoCalcular(dados.motivo || "Não foi possível gerar a previsão.");
      }

    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar no servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={28} color="#3A3A3A" />
        </TouchableOpacity>

        <Text style={styles.title}>{"\n"}Previsão de Peso por Dia</Text>
        <Text style={styles.subtitle}>{"\n"}{nome}{"\n"}({codigo})</Text>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateButtonText}>
            📅 {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        <TouchableOpacity style={styles.fetchButton} onPress={calcularPrevisaoPorDiaSemana}>
          <Text style={styles.fetchButtonText}>Calcular Previsão</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Calculando...</Text>
          </View>
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : resultadoPrevisao ? (
          <View style={{ marginHorizontal: 12, marginTop: 12 }}>
            <View style={[styles.blockContainer, { padding: 12 }]}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#00695c", marginBottom: 8 }}>
                Previsão para {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </Text>

              <Text style={{ fontSize: 22, fontWeight: "800", color: "#2e7d32" }}>
                {resultadoPrevisao.media} kg
              </Text>

              <Text style={{ marginTop: 8, color: "#444" }}>
                Base: média populacional de {resultadoPrevisao.n} dias (mesmo dia da semana).
              </Text>

              {estatisticas && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontWeight: "700" }}>Indicadores usados:</Text>
                  <Text>• Média: {estatisticas.media} kg</Text>
                  <Text>• Desvio padrão: {estatisticas.desvioPadrao} kg</Text>
                  <Text>• Assimetria: {estatisticas.assimetria}</Text>
                  <Text>• Curtose: {estatisticas.curtose}</Text>
                </View>
              )}
            </View>
          </View>
        ) : motivoNaoCalcular ? (
          <View style={{ marginHorizontal: 12, marginTop: 12 }}>
            <View style={[styles.blockContainer, { padding: 12 }]}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#d32f2f", marginBottom: 8 }}>
                Não foi possível gerar a previsão
              </Text>
              <Text style={{ color: "#444" }}>{motivoNaoCalcular}</Text>

              {estatisticas && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontWeight: "700" }}>Estatísticas parciais:</Text>
                  <Text>• Observações (dias): {estatisticas.totalMedicoes}</Text>
                  <Text>• Média (se houver): {estatisticas.media ?? "—"} kg</Text>
                  <Text>• Assimetria: {estatisticas.assimetria ?? "—"}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.infoText}>Escolha uma data e toque em "Calcular Previsão".</Text>
        )}

        {/* Indicadores expansíveis */}
        {estatisticas && (
          <View style={styles.statsOuter}>
            <TouchableOpacity style={styles.statsHeader} onPress={toggleStats} activeOpacity={0.8}>
              <Text style={styles.statsHeaderText}>📈 Indicadores Estatísticos</Text>
              <Text style={styles.statsHeaderToggle}>{statsExpanded ? "Ocultar" : "Mostrar"}</Text>
            </TouchableOpacity>

            <Animated.View style={[styles.statsAnimated, { height: animatedHeight, opacity: animatedOpacity }]}>
              <ScrollView horizontal contentContainerStyle={styles.statsGrid} showsHorizontalScrollIndicator={false}>
                <View style={[styles.statCard, { borderLeftColor: "#4c8bafff" }]}>
                  <Text style={styles.statCardTitle}>Observações (dias)</Text>
                  <Text style={styles.statCardValue}>{estatisticas?.totalMedicoes ?? "—"}</Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: "#4CAF50" }]}>
                  <Text style={styles.statCardTitle}>Média</Text>
                  <Text style={styles.statCardValue}>{estatisticas?.media ?? "—"} kg</Text>
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
              </ScrollView>
            </Animated.View>
          </View>
        )}

      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onToggleTheme={() => setDarkTheme(!darkTheme)}
        isDarkTheme={darkTheme}
        onLogout={() => {
          setSettingsVisible(false);
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        }}
      />

      <View style={styles.bottomContainer}>
        <BottomNav
          navigation={navigation}
          onOpenSettings={() => setSettingsVisible(true)}
        />
      </View>
    </View>
  );
}

// Reaproveitamos os estilos da sua tela original para manter o mesmo visual
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
  fetchButton: {
    backgroundColor: "#2e7d32",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 25,
    alignSelf: "center",
    marginBottom: 20,
  },
  fetchButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
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
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
    borderRadius: 10,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00695c",
  },
  blockToggle: {
    fontSize: 18,
    color: "#004d40",
  },
  subBlock: {
    marginTop: 6,
    backgroundColor: "#f1f8e9",
    borderRadius: 10,
    marginHorizontal: 10,
    paddingBottom: 8,
  },
  subBlockTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#33691e",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#b0bec5",
  },
  positiveCard: {
    borderColor: "#4CAF50",
    borderWidth: 2,
  },
  negativeCard: {
    borderColor: "#F44336",
    borderWidth: 2,
    backgroundColor: "#FFEBEE",
  },
  alertText: {
    color: "#D32F2F",
    fontWeight: "bold",
    marginTop: 5,
    fontSize: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTime: { fontSize: 15, fontWeight: "bold", color: "#0288d1" },
  balanceLine: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2196F3",
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  balanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
  },
  ladoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  blockHeaderExpanded: {
    backgroundColor: "#b2dfdb",
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
  subBlockHeaderExpanded: {
    backgroundColor: "#c5e1a5",
  },
  cardText: { fontSize: 15, color: "#333", marginTop: 5 },
  bold: { fontWeight: "bold" },
  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  backButton: { position: "absolute", top: 40, left: 20 },

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
});
