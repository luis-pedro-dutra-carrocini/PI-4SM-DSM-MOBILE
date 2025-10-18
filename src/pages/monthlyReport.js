import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ToastAndroid,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";

import { LINKAPI, PORTAPI } from "../utils/global";
import {
  validarTokens,
  pegarTokens,
  obterDadosUsuario,
} from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

const screenWidth = Dimensions.get("window").width;

export default function MonthlyReportScreen({ navigation, route }) {
  const { codigo, nome } = route.params;

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [medicoes, setMedicoes] = useState([]);
  const [pesoUsuario, setPesoUsuario] = useState(0);
  const [porcentagemMaxima, setPorcentagemMaxima] = useState(10);

  useEffect(() => {
    bucarDadosUsuario();
  }, []);

  const bucarDadosUsuario = async () => {
    try {
      const response = await obterDadosUsuario(navigation);
      if (response === "false") return;

      setPesoUsuario(response.usuario.UsuarioPeso || 70);
      setPorcentagemMaxima(
        response.usuario.UsuarioPesoMaximoPorcentagem || 10
      );
    } catch (error) {
      ToastAndroid.show("Erro ao obter dados do usuário", ToastAndroid.SHORT);
    }
  };

  // Peso máximo de UM lado
  const pesoMaximoPermitido = (pesoUsuario * (porcentagemMaxima / 100)) / 2;

  useEffect(() => {
    buscarRelatorioMensal();
  }, [selectedDate]);

  const handleMonthChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const buscarRelatorioMensal = async () => {
    try {
      setLoading(true);
      setErro("");
      setMedicoes([]);

      const resposta = await validarTokens(0, navigation);
      if (resposta !== "true")
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);

      const tokens = await pegarTokens();
      const { accessToken } = tokens;

      const mes = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const ano = selectedDate.getFullYear();

      const response = await fetch(
        `${LINKAPI}${PORTAPI}/medicoes/mensal/${ano}/${mes}/${codigo}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const erroData = await response.json();
        setErro(erroData.error || "Erro ao obter relatório mensal");
        return;
      }

      const dados = await response.json();
      setMedicoes(dados || []);
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
    if (l.includes("esquer")) return "esquerda";
    if (l.includes("direit")) return "direita";
    if (l.includes("amb")) return "ambos";
    return "outro";
  };

  // Agrupar medições por dia
  const groupByDay = () => {
    const map = {};
    medicoes.forEach((m) => {
      const date = parseISO(m.MedicaoData);
      const key = format(date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  };

  const processarMedicoes = () => {
    const grouped = groupByDay();

    let maiorEsq = null;
    let maiorDir = null;
    let menorEsq = null;
    let menorDir = null;

    const dailyAvgs = [];

    Object.keys(grouped)
      .sort() // garante que as datas fiquem em ordem crescente
      .forEach((day) => {
        const items = grouped[day];
        const left = [];
        const right = [];

        items.forEach((m) => {
          const side = localSide(m.MedicaoLocal);
          const peso = Number(m.MedicaoPeso || 0);

          if (side === "esquerda") left.push(peso);
          else if (side === "direita") right.push(peso);
          else if (side === "ambos") {
            left.push(peso);
            right.push(peso);
          }

          const data = parseISO(m.MedicaoData);

          // Maior/menor medição por lado
          if (side === "esquerda" || side === "ambos") {
            if (!maiorEsq || peso > maiorEsq.peso)
              maiorEsq = { peso, data, lado: "esquerda" };
            if (!menorEsq || peso < menorEsq.peso)
              menorEsq = { peso, data, lado: "esquerda" };
          }
          if (side === "direita" || side === "ambos") {
            if (!maiorDir || peso > maiorDir.peso)
              maiorDir = { peso, data, lado: "direita" };
            if (!menorDir || peso < menorDir.peso)
              menorDir = { peso, data, lado: "direita" };
          }
        });

        const mediaEsq = left.length
          ? left.reduce((a, b) => a + b, 0) / left.length
          : 0;
        const mediaDir = right.length
          ? right.reduce((a, b) => a + b, 0) / right.length
          : 0;

        dailyAvgs.push({
          dia: format(parseISO(day), "dd"),
          total: Number((mediaEsq + mediaDir).toFixed(2)),
        });
      });

    return { dailyAvgs, maiorEsq, maiorDir, menorEsq, menorDir };
  };

  const { dailyAvgs, maiorEsq, maiorDir, menorEsq, menorDir } =
    processarMedicoes();

  const chartData = {
    labels: dailyAvgs.map((d) => d.dia),
    datasets: [
      {
        data: dailyAvgs.map((d) => d.total),
        color: () => "#0288d1",
      },
    ],
  };

  const renderMedicaoCard = (titulo, medicao, tipo) => {
    if (!medicao) return null;
    const acimaLimite = medicao.peso > pesoMaximoPermitido;
    return (
      <View
        style={[
          styles.card,
          acimaLimite && styles.alertCard,
          { borderLeftWidth: 6, borderLeftColor: tipo === "maior" ? "#0288d1" : "#43a047" },
        ]}
      >
        <Text style={styles.bold}>
          {tipo === "maior" ? "📈" : "📉"} {titulo} ({medicao.lado})
        </Text>
        <Text>Data: {format(medicao.data, "dd/MM/yyyy HH:mm", { locale: ptBR })}</Text>
        <Text>Peso: {medicao.peso.toFixed(2)} kg</Text>
        {acimaLimite && (
          <Text style={styles.alertText}>
            ⚠️ Acima do limite permitido ({pesoMaximoPermitido.toFixed(2)} kg)
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#3A3A3A" />
        </TouchableOpacity>

        <Text style={styles.title}>Relatório Mensal</Text>
        <Text style={styles.subtitle}>
          {nome}
          {"\n"}({codigo})
        </Text>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateButtonText}>
            📆 {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleMonthChange}
          />
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Carregando...</Text>
          </View>
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : medicoes.length === 0 ? (
          <Text style={styles.infoText}>Nenhuma medição encontrada.</Text>
        ) : (
          <>

            <Text style={styles.graphTitle}>📊 Média Diária do Mês</Text>
            <LineChart
              data={chartData}
              width={screenWidth - 20}
              height={220}
              yAxisSuffix=" kg"
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#e0f7fa",
                backgroundGradientTo: "#b2ebf2",
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(0, 88, 136, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              style={styles.graph}
              bezier
              fromZero
            />

            {/* ======== NOVO GRÁFICO COMPARATIVO ESQ x DIR ======== */}
            <Text style={[styles.graphTitle, { marginTop: 25 }]}>
              ⚖️ Comparativo Esquerda x Direita
            </Text>

            <LineChart
              data={{
                labels: dailyAvgs.map((d) => d.dia),
                datasets: [
                  {
                    data: medicoes.length
                      ? (() => {
                        const grouped = groupByDay();
                        return Object.keys(grouped)
                          .sort()
                          .map((day) => {
                            const items = grouped[day];
                            const left = items
                              .filter(
                                (m) =>
                                  localSide(m.MedicaoLocal) === "esquerda" ||
                                  localSide(m.MedicaoLocal) === "ambos"
                              )
                              .map((m) => Number(m.MedicaoPeso));
                            return left.length
                              ? left.reduce((a, b) => a + b, 0) / left.length
                              : 0;
                          });
                      })()
                      : [],
                    color: () => "#1976d2",
                    strokeWidth: 2,
                  },
                  {
                    data: medicoes.length
                      ? (() => {
                        const grouped = groupByDay();
                        return Object.keys(grouped)
                          .sort()
                          .map((day) => {
                            const items = grouped[day];
                            const right = items
                              .filter(
                                (m) =>
                                  localSide(m.MedicaoLocal) === "direita" ||
                                  localSide(m.MedicaoLocal) === "ambos"
                              )
                              .map((m) => Number(m.MedicaoPeso));
                            return right.length
                              ? right.reduce((a, b) => a + b, 0) / right.length
                              : 0;
                          });
                      })()
                      : [],
                    color: () => "#43a047",
                    strokeWidth: 2,
                  },
                ],
                legend: ["Esquerda", "Direita"],
              }}
              width={screenWidth - 20}
              height={180} // 🔹 menor altura para compactar visualmente
              yAxisSuffix=" kg"
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#e0f7fa",
                backgroundGradientTo: "#b2ebf2",
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                propsForDots: { r: "4", strokeWidth: "2" },
                propsForBackgroundLines: { strokeDasharray: "3" },
              }}
              style={[styles.graph, { marginBottom: 20 }]}
            />

            {renderMedicaoCard("Maior Medição", maiorEsq, "maior")}
            {renderMedicaoCard("Maior Medição", maiorDir, "maior")}
            {renderMedicaoCard("Menor Medição", menorEsq, "menor")}
            {renderMedicaoCard("Menor Medição", menorDir, "menor")}


          </>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e0f7fa" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 60,
    color: "#3A3A3A",
  },
  subtitle: { textAlign: "center", color: "#555", marginBottom: 20 },
  dateButton: {
    alignSelf: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#9dadaf",
    marginBottom: 15,
  },
  dateButtonText: { fontSize: 16, color: "#333" },
  loadingContainer: { alignItems: "center", marginTop: 30 },
  errorText: { color: "red", textAlign: "center", marginTop: 20 },
  infoText: { textAlign: "center", color: "#555", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 14,
    borderRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#b0bec5",
  },
  alertCard: {
    borderColor: "#d32f2f",
    backgroundColor: "#ffebee",
    borderWidth: 2,
  },
  alertText: { color: "#d32f2f", marginTop: 5, fontWeight: "bold" },
  bold: { fontWeight: "bold", color: "#000" },
  graphTitle: {
    fontSize: 18,
    textAlign: "center",
    marginVertical: 10,
    color: "#333",
  },
  graph: { alignSelf: "center", borderRadius: 10 },
  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  backButton: { position: "absolute", top: 40, left: 20 },
});
