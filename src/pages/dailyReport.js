import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, ToastAndroid } from "react-native";
import { LineChart } from "react-native-chart-kit";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Dimensions } from "react-native";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";

import { LINKAPI, PORTAPI } from "../utils/global";
import { validarTokens, pegarTokens, obterDadosUsuario, roundTo2 } from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

const screenWidth = Dimensions.get("window").width;

export default function DailyReportScreen({ navigation, route }) {
  const { codigo, nome } = route.params;

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [medicoes, setMedicoes] = useState([]);
  const [erro, setErro] = useState("");
  const [expandedHour, setExpandedHour] = useState(null);
  const [expandedSubHour, setExpandedSubHour] = useState(null);

  // Variáveis de estado para o peso e a porcentagem máxima
  const [pesoUsuario, setPesoUsuario] = useState(0);
  const [porcentagemMaxima, setPorcentagemMaxima] = useState(10); // Valor padrão

  useEffect(() => {
    bucarDados();
  }, []);

  // Use useEffect para buscar o relatório sempre que a data ou os dados do usuário mudarem
  useEffect(() => {
    // Só busca se já tiver dados de usuário (peso) ou se o peso for 0 e os dados estiverem pendentes
    if (pesoUsuario > 0 || medicoes.length === 0) {
      buscarRelatorio();
    }
  }, [selectedDate, pesoUsuario, porcentagemMaxima]);

  const bucarDados = async () => {
    try {
      const response = await obterDadosUsuario(navigation);
      if (response === "false") return;

      // Atualiza os estados com os dados do usuário
      // Utiliza fallback de 70kg e 10% caso os valores não existam
      setPesoUsuario(response.usuario.UsuarioPeso || 70);
      setPorcentagemMaxima(response.usuario.UsuarioPesoMaximoPorcentagem || 10);

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

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const buscarRelatorio = async () => {
    try {
      setLoading(true);
      setErro("");
      setMedicoes([]);

      const resposta = await validarTokens(0, navigation);
      if (resposta !== "true") {
        if (resposta === "false") return;
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

      let tokens = await pegarTokens();
      const { accessToken } = tokens;
      const dataFormatada = format(selectedDate, "yyyy-MM-dd");

      const response = await fetch(
        `${LINKAPI}${PORTAPI}/medicoes/dia/${dataFormatada}/${codigo}`,
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
        setErro(erroData.error || "Erro ao obter relatório diário");
        return;
      }

      const dados = await response.json();
      setMedicoes(dados);
    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar no servidor.");
    } finally {
      setLoading(false);
    }
  };

  // 🧮 Agrupa medições em intervalos de 3h
  const agruparPorIntervalo = () => {
    const grupos = {};
    medicoes.forEach((item) => {
      const hora = new Date(item.MedicaoData).getHours();
      const intervalo = Math.floor(hora / 3) * 3;
      const key = `${intervalo.toString().padStart(2, "0")}:00 - ${(
        intervalo + 3
      )
        .toString()
        .padStart(2, "0")}:00`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });
    return grupos;
  };

  const grupos = agruparPorIntervalo();

  // 📊 Gráfico (3 em 3 horas) — somando esquerda + direita
  const horas = Array.from({ length: 8 }, (_, i) => `${(i * 3)
    .toString()
    .padStart(2, "0")}:00`);

  const medias = horas.map((h, i) => {
    const key = `${(i * 3).toString().padStart(2, "0")}:00 - ${((i + 1) * 3)
      .toString()
      .padStart(2, "0")}:00`;
    const med = grupos[key];
    if (!med || med.length === 0) return 0;

    // Agrupa as medições por lado
    const esquerda = med.filter((m) =>
      m.MedicaoLocal?.toLowerCase().includes("esquerda")
    );
    const direita = med.filter((m) =>
      m.MedicaoLocal?.toLowerCase().includes("direita")
    );

    // Calcula média de cada lado separadamente
    const mediaEsq =
      esquerda.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
      (esquerda.length || 1);
    const mediaDir =
      direita.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
      (direita.length || 1);

    // Soma as duas médias (peso total do intervalo)
    const total = mediaEsq + mediaDir;

    return parseFloat(total.toFixed(2));
  });

  const chartData = {
    labels: horas,
    datasets: [
      {
        data: medias,
        color: () => "#0288d1",
        strokeWidth: 2,
      },
    ],
  };

  // 🧠 Função para agrupar por hora e minuto (média e junção esquerda/direita)
  const agruparPorHoraMinuto = (lista) => {
    const mapa = {};
    lista.forEach((item) => {
      const data = new Date(item.MedicaoData);
      const hora = data.getHours().toString().padStart(2, "0");
      const minuto = data.getMinutes().toString().padStart(2, "0");
      const chave = `${hora}:${minuto}`;
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(item);
    });

    return Object.entries(mapa).map(([hora, valores]) => {
      // Separa por lado
      const esquerda = valores.filter((v) => v.MedicaoLocal?.toLowerCase().includes("esquerda"));
      const direita = valores.filter((v) => v.MedicaoLocal?.toLowerCase().includes("direita"));

      const pesoEsq =
        esquerda.reduce((acc, v) => acc + Number(v.MedicaoPeso || 0), 0) /
        (esquerda.length || 1);
      const pesoDir =
        direita.reduce((acc, v) => acc + Number(v.MedicaoPeso || 0), 0) /
        (direita.length || 1);

      const total = pesoEsq + pesoDir;
      const inclinacao = pesoEsq === pesoDir ? "equilibrado" : pesoEsq > pesoDir ? "esquerda" : "direita";

      return {
        hora,
        pesoEsq: parseFloat(pesoEsq.toFixed(2)),
        pesoDir: parseFloat(pesoDir.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        inclinacao,
      };
    });
  };

  // Cálculo do limite máximo de peso
  const pesoMaximoPermitido = pesoUsuario * (porcentagemMaxima / 100);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Botão Voltar */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={28} color="#3A3A3A" />
        </TouchableOpacity>

        <Text style={styles.title}>Relatório Diário</Text>
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

        <TouchableOpacity style={styles.fetchButton} onPress={buscarRelatorio}>
          <Text style={styles.fetchButtonText}>Buscar Relatório</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Carregando...</Text>
          </View>
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : medicoes.length === 0 ? (
          <Text style={styles.infoText}>
            Escolha uma data e toque em "Buscar Relatório".
          </Text>
        ) : (
          <>
            <Text style={styles.graphTitle}>
              📊 Média de Peso por Intervalo (3h)
            </Text>
            <LineChart
              data={chartData}
              width={screenWidth - 20}
              height={220}
              yAxisSuffix="kg"
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
              onDataPointClick={(data) => {
                const horaSelecionada = horas[data.index];
                setExpandedHour(expandedHour === horaSelecionada ? null : horaSelecionada);
              }}
            />

            <Text style={[styles.graphTitle, { marginTop: 25 }]}>
              ⚖️ Comparativo Esquerda x Direita (3h)
            </Text>

            <LineChart
              data={{
                labels: horas,
                datasets: [
                  {
                    // Linha da Esquerda
                    data: horas.map((h, i) => {
                      const key = `${(i * 3).toString().padStart(2, "0")}:00 - ${((i + 1) * 3)
                        .toString()
                        .padStart(2, "0")}:00`;
                      const med = grupos[key];
                      if (!med || med.length === 0) return 0;
                      const esquerda = med.filter((m) =>
                        m.MedicaoLocal?.toLowerCase().includes("esquerda")
                      );
                      const mediaEsq =
                        esquerda.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
                        (esquerda.length || 1);
                      return parseFloat(mediaEsq.toFixed(2));
                    }),
                    color: () => "#1976d2", // Azul: Esquerda
                    strokeWidth: 2,
                  },
                  {
                    // Linha da Direita
                    data: horas.map((h, i) => {
                      const key = `${(i * 3).toString().padStart(2, "0")}:00 - ${((i + 1) * 3)
                        .toString()
                        .padStart(2, "0")}:00`;
                      const med = grupos[key];
                      if (!med || med.length === 0) return 0;
                      const direita = med.filter((m) =>
                        m.MedicaoLocal?.toLowerCase().includes("direita")
                      );
                      const mediaDir =
                        direita.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
                        (direita.length || 1);
                      return parseFloat(mediaDir.toFixed(2));
                    }),
                    color: () => "#43a047", // Verde: Direita
                    strokeWidth: 2,
                  },
                ],
                legend: ["Esquerda", "Direita"],
              }}
              width={screenWidth - 20}
              height={180}
              yAxisSuffix="kg"
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
              style={[styles.graph, { marginBottom: 10 }]}
            />

            {horas.map((h, i) => {
              const key = `${(i * 3).toString().padStart(2, "0")}:00 - ${((i + 1) * 3)
                .toString()
                .padStart(2, "0")}:00`;
              const itens = grupos[key];
              if (!itens || itens.length === 0) return null;

              const subGrupos = {};
              itens.forEach((item) => {
                const hora = new Date(item.MedicaoData)
                  .getHours()
                  .toString()
                  .padStart(2, "0");
                if (!subGrupos[hora]) subGrupos[hora] = [];
                subGrupos[hora].push(item);
              });

              return (
                <View key={key} style={styles.blockContainer}>
                  {/* BLOCO PRINCIPAL */}
                  <TouchableOpacity
                    style={[
                      styles.blockHeader,
                      expandedHour === h && styles.blockHeaderExpanded,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setExpandedHour(expandedHour === h ? null : h)}
                  >
                    <Text style={styles.blockTitle}>{key}</Text>
                    <Text style={styles.blockToggle}>
                      {expandedHour === h ? "▼" : "▶"}
                    </Text>
                  </TouchableOpacity>

                  {/* SUBBLOCOS */}
                  {expandedHour === h &&
                    Object.entries(subGrupos).map(([subHora, lista]) => {
                      const mediasHora = agruparPorHoraMinuto(lista);
                      // Ordena as medições em ordem crescente de hora e minuto
                      const mediasHoraOrdenadas = [...mediasHora].sort((a, b) => {
                        const [hA, mA] = a.hora.split(":").map(Number);
                        const [hB, mB] = b.hora.split(":").map(Number);

                        if (hA === hB) return mA - mB;
                        return hA - hB;
                      });

                      return (
                        <View key={subHora} style={styles.subBlock}>
                          <TouchableOpacity
                            style={[
                              styles.subBlockHeader,
                              expandedSubHour === subHora && styles.subBlockHeaderExpanded,
                            ]}
                            activeOpacity={0.7}
                            onPress={() =>
                              setExpandedSubHour(expandedSubHour === subHora ? null : subHora)
                            }
                          >
                            <Text style={styles.subBlockTitle}>{subHora}:00</Text>
                            <Text style={styles.blockToggle}>
                              {expandedSubHour === subHora ? "▼" : "▶"}
                            </Text>
                          </TouchableOpacity>

                          {expandedSubHour === subHora &&
                            mediasHoraOrdenadas.map((dado, idx) => {
                              // Lógica de cor condicional: positivo ou negativo
                              const isNegative = dado.total > pesoMaximoPermitido;
                              const cardStyle = isNegative ? styles.negativeCard : styles.positiveCard;

                              return (
                                <View key={idx} style={[styles.card, cardStyle]}>
                                  <View style={styles.cardHeader}>
                                    <Text style={styles.cardTime}>{dado.hora}</Text>

                                    {/* Lógica de equilíbrio */}
                                    {(() => {
                                      const diferenca = Math.abs(dado.pesoEsq - dado.pesoDir);
                                      const maiorPeso = Math.max(dado.pesoEsq, dado.pesoDir);
                                      // Previne divisão por zero
                                      const percentual = maiorPeso > 0 ? (diferenca / maiorPeso) * 100 : 0;

                                      let posicao = "center";
                                      let cor = "#2196F3";

                                      if (percentual > 5) {
                                        if (dado.pesoEsq > dado.pesoDir)
                                          posicao = "flex-start";
                                        else posicao = "flex-end";
                                        cor = "red";
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
                                    <Text style={styles.cardText}>
                                      <Text style={styles.bold}>Esquerda:</Text> {dado.pesoEsq} kg
                                    </Text>
                                    <Text style={styles.cardText}>
                                      <Text style={styles.bold}>Direita:</Text> {dado.pesoDir} kg
                                    </Text>
                                  </View>

                                  <Text style={styles.cardText}>
                                    <Text style={styles.bold}>Total:</Text> {dado.total} kg
                                  </Text>
                                  {isNegative && (
                                    <Text style={styles.alertText}>
                                      ⚠️ Limite de {porcentagemMaxima}% excedido ({pesoMaximoPermitido.toFixed(2)} kg)!
                                    </Text>
                                  )}
                                </View>
                              );
                            })}
                        </View>
                      );
                    })}
                </View>
              );
            })}

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
    backgroundColor: "#0288d1",
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
  // ESTILOS ADICIONADOS PARA A LÓGICA DE PESO PERMITIDO
  positiveCard: {
    borderColor: "#4CAF50", // Verde - Positivo (dentro do limite)
    borderWidth: 2,
  },
  negativeCard: {
    borderColor: "#F44336", // Vermelho - Negativo (limite excedido)
    borderWidth: 2,
    backgroundColor: "#FFEBEE", // Fundo levemente vermelho para destaque
  },
  alertText: {
    color: "#D32F2F",
    fontWeight: "bold",
    marginTop: 5,
    fontSize: 14,
  },
  // FIM DOS ESTILOS ADICIONADOS

  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTime: { fontSize: 15, fontWeight: "bold", color: "#0288d1" },
  balanceLine: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2196F3", // cor padrão (azul)
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
});