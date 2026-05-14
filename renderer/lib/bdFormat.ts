const TK = "৳";

export function bdMoney(value: number, currencySymbol = TK): string {
  if (currencySymbol === TK) {
    return TK + bdNumber(value);
  }
  return `${currencySymbol}${value.toFixed(2)}`;
}

export function bdNumber(value: number): string {
  const [intPart, fracPart] = value.toFixed(2).split(".");
  const formatted = bdFormatInt(intPart);
  return `${formatted}.${fracPart}`;
}

function bdFormatInt(intStr: string): string {
  const isNeg = intStr.startsWith("-");
  const abs = isNeg ? intStr.slice(1) : intStr;
  if (abs.length <= 3) return intStr;

  const last3 = abs.slice(-3);
  const rest = abs.slice(0, -3);
  const groups: string[] = [];
  let i = rest.length;
  while (i > 0) {
    const start = Math.max(0, i - 2);
    groups.unshift(rest.slice(start, i));
    i -= 2;
  }
  return (isNeg ? "-" : "") + groups.join(",") + "," + last3;
}

export function bdDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-BD", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function bdTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-BD", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function bdDateTime(date: Date | string): string {
  return `${bdDate(date)}, ${bdTime(date)} BST`;
}
