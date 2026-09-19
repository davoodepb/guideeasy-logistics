/**
 * Utilitário de Sanitização e Tratamento de Datas
 * Especializado na conversão de padrões americanos (MM/DD/AAAA) para europeus/portugueses (DD/MM/AAAA)
 * com validações rigorosas de consistência de calendário e heurísticas de deteção de formato.
 */

export interface DateSanitizationResult {
  isValid: boolean;
  convertedDate: string; // Formato DD/MM/AAAA se for válido
  originalValue: unknown;
  error?: string; // Detalhes do erro se for inválido
  parsedComponents?: {
    day: number;
    month: number;
    year: number;
  };
}

export interface BatchValidationResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  detectedFormatPattern: "US_PROBABLE" | "EU_PROBABLE" | "MIXED_OR_AMBIGUOUS" | "UNKNOWN";
  results: DateSanitizationResult[];
  errorsSummary: { rowIndex: number; value: unknown; error: string }[];
}

/**
 * Verifica se um ano é bissexto.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Retorna o número de dias num determinado mês e ano.
 */
export function getDaysInMonth(month: number, year: number): number {
  const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return daysInMonths[month - 1] || 31;
}

/**
 * Converte um número serial de data do Excel (ex: 46173) numa instância de Date do JavaScript.
 * Lida com o bug histórico do ano bissexto de 1900 do Excel.
 */
export function excelSerialToJSDate(serial: number): Date {
  // Ajuste para o fuso horário local e correção do bug de 1900 do Excel
  let utcDays = Math.floor(serial - 25569);
  if (serial > 60) {
    utcDays -= 1; // Corrige o dia inexistente 29/02/1900 que o Excel assume
  }
  const utcValue = utcDays * 86400 * 1000;
  return new Date(utcValue);
}

/**
 * Formata um objeto Date do JS no padrão DD/MM/AAAA.
 */
export function formatToPTDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Sanitiza e converte uma única entrada de data no formato americano (MM/DD/AAAA ou similar)
 * para o formato europeu/português (DD/MM/AAAA) com validações robustas.
 *
 * @param value Qualquer entrada de data (String, Date, Número Serial do Excel)
 * @returns DateSanitizationResult contendo o estado da conversão e o valor sanitizado
 */
export function sanitizeAndConvertUSDate(value: unknown): DateSanitizationResult {
  const result: DateSanitizationResult = {
    isValid: false,
    convertedDate: "",
    originalValue: value,
  };

  if (value === null || value === undefined || String(value).trim() === "") {
    result.error = "Data vazia ou nula.";
    return result;
  }

  try {
    // 1. Caso de uso: O valor já é um objeto Date
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        result.error = "Objeto Date inválido (Invalid Date).";
        return result;
      }
      result.isValid = true;
      result.convertedDate = formatToPTDate(value);
      result.parsedComponents = {
        day: value.getDate(),
        month: value.getMonth() + 1,
        year: value.getFullYear(),
      };
      return result;
    }

    // 2. Caso de uso: O valor é um número serial do Excel (ex: 45012)
    const numericValue = Number(value);
    if (
      !isNaN(numericValue) &&
      typeof value !== "boolean" &&
      numericValue > 1 &&
      numericValue < 3000000
    ) {
      const date = excelSerialToJSDate(numericValue);
      if (!isNaN(date.getTime())) {
        result.isValid = true;
        result.convertedDate = formatToPTDate(date);
        result.parsedComponents = {
          day: date.getDate(),
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        };
        return result;
      }
    }

    // 3. Caso de uso: Entrada de texto (String)
    const cleanStr = String(value).trim().replace(/\s+/g, "");

    // Regex flexível que aceita MM/DD/AAAA, M/D/AAAA, MM-DD-AAAA com vários separadores
    const usRegex = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
    const match = cleanStr.match(usRegex);

    if (!match) {
      // Tenta verificar se está no formato ISO (AAAA-MM-DD)
      const isoRegex = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
      const isoMatch = cleanStr.match(isoRegex);

      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);

        return validateAndBuildResult(day, month, year, value, result);
      }

      result.error = "Formato de data não reconhecido (esperado MM/DD/AAAA).";
      return result;
    }

    // Isola os componentes com base na estrutura americana: MM/DD/AAAA
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    return validateAndBuildResult(day, month, year, value, result);
  } catch (err: unknown) {
    result.error = `Erro inesperado no processamento: ${err instanceof Error ? err.message : String(err)}`;
    return result;
  }
}

/**
 * Função interna para validar a integridade da data e construir o resultado
 */
function validateAndBuildResult(
  day: number,
  month: number,
  year: number,
  originalValue: unknown,
  result: DateSanitizationResult,
): DateSanitizationResult {
  // Validação do intervalo do ano
  if (year < 1900 || year > 2100) {
    result.error = `Ano fora do limite razoável (1900-2100): ${year}`;
    return result;
  }

  // Validação do mês (Sempre na segunda posição na saída DD/MM/AAAA)
  if (month < 1 || month > 12) {
    result.error = `Mês inválido: ${month}. No padrão americano MM/DD/AAAA, o primeiro bloco deve ser o mês (1-12). Se o ficheiro estiver no formato DD/MM/AAAA, isto indica um erro de leitura.`;
    return result;
  }

  // Validação do dia de acordo com as regras do mês e ano bissexto
  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    if (month === 2 && day === 29) {
      result.error = `Dia inválido: 29 de Fevereiro não é válido no ano ${year} (não é bissexto).`;
    } else {
      result.error = `Dia inválido: ${day} para o mês ${month}. O mês selecionado tem no máximo ${maxDays} dias.`;
    }
    return result;
  }

  // Se tudo passar, a data é válida e convertida
  result.isValid = true;
  const strDay = String(day).padStart(2, "0");
  const strMonth = String(month).padStart(2, "0");
  result.convertedDate = `${strDay}/${strMonth}/${year}`;
  result.parsedComponents = { day, month, year };

  return result;
}

/**
 * Valida em lote uma lista de registos de um ficheiro importado.
 * Também aplica heurísticas para detetar se o utilizador enviou um ficheiro
 * que na verdade já estava no formato DD/MM/AAAA, ajudando a evitar falsos positivos
 * e fornecendo um aviso proativo.
 *
 * @param rows Lista de registos importados (ex: JSON obtido do Excel/CSV)
 * @param dateColumn Key da coluna que contém a data
 */
export function validateImportedFileDates(
  rows: Record<string, unknown>[],
  dateColumn: string,
): BatchValidationResult {
  const results: DateSanitizationResult[] = [];
  const errorsSummary: { rowIndex: number; value: unknown; error: string }[] = [];

  let validCount = 0;
  let invalidCount = 0;

  // Variáveis para heurística de deteção de formato
  let valuesWithFirstBlockGreaterThan12 = 0; // Ex: 15/04/2026 -> indica formato europeu (primeiro bloco > 12)
  let valuesWithSecondBlockGreaterThan12 = 0; // Ex: 04/15/2026 -> indica formato americano (segundo bloco > 12)
  let totalAnalysableStrings = 0;

  rows.forEach((row, index) => {
    const rawVal = row[dateColumn];
    const conversion = sanitizeAndConvertUSDate(rawVal);

    results.push(conversion);

    if (conversion.isValid) {
      validCount++;
    } else {
      invalidCount++;
      errorsSummary.push({
        rowIndex: index + 1, // 1-based index para o utilizador
        value: rawVal,
        error: conversion.error || "Erro desconhecido",
      });
    }

    // Heurística de deteção de padrão no texto bruto
    if (rawVal && typeof rawVal === "string") {
      const clean = rawVal.trim().replace(/\s+/g, "");
      const usRegex = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
      const match = clean.match(usRegex);
      if (match) {
        totalAnalysableStrings++;
        const block1 = parseInt(match[1], 10);
        const block2 = parseInt(match[2], 10);

        if (block1 > 12 && block2 <= 12) {
          valuesWithFirstBlockGreaterThan12++;
        } else if (block2 > 12 && block1 <= 12) {
          valuesWithSecondBlockGreaterThan12++;
        }
      }
    }
  });

  // Determinar padrão provável
  let detectedFormatPattern: BatchValidationResult["detectedFormatPattern"] = "UNKNOWN";
  if (totalAnalysableStrings > 0) {
    if (valuesWithFirstBlockGreaterThan12 > 0 && valuesWithSecondBlockGreaterThan12 === 0) {
      detectedFormatPattern = "EU_PROBABLE"; // Primeiro bloco tem valores > 12, então deve ser DD/MM/AAAA
    } else if (valuesWithSecondBlockGreaterThan12 > 0 && valuesWithFirstBlockGreaterThan12 === 0) {
      detectedFormatPattern = "US_PROBABLE"; // Segundo bloco tem valores > 12, então deve ser MM/DD/AAAA
    } else if (valuesWithFirstBlockGreaterThan12 > 0 && valuesWithSecondBlockGreaterThan12 > 0) {
      detectedFormatPattern = "MIXED_OR_AMBIGUOUS"; // Ambos ocorrem ou dados misturados
    } else {
      // Todos os blocos são <= 12 (ex: todas as datas são menores que o dia 12 de cada mês)
      detectedFormatPattern = "MIXED_OR_AMBIGUOUS";
    }
  }

  return {
    totalRows: rows.length,
    validCount,
    invalidCount,
    detectedFormatPattern,
    results,
    errorsSummary,
  };
}
