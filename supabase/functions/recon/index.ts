import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReconRequest {
  target: string;
  modules: string[];
}

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

const DNS_TYPES = [1, 15, 16, 2, 5, 28] as const;
const DNS_TYPE_NAMES: Record<number, string> = { 1: "A", 15: "MX", 16: "TXT", 2: "NS", 5: "CNAME", 28: "AAAA" };

function isIP(target: string): boolean {
  return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(target.trim());
}

function isDomain(target: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(target.trim());
}

async function dnsLookup(domain: string): Promise<Record<string, unknown>> {
  const records: Record<string, string[]> = {};
  for (const type of DNS_TYPES) {
    try {
      const resp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, {
        headers: { "Accept": "application/dns-json" },
      });
      if (!resp.ok) continue;
      const json = await resp.json() as { Answer?: DnsAnswer[] };
      if (json.Answer && json.Answer.length > 0) {
        const typeName = DNS_TYPE_NAMES[type] || `TYPE${type}`;
        records[typeName] = json.Answer.map((a) => a.data);
      }
    } catch {
      // network or parse failure for this record type — skip
    }
  }
  return { records, resolved: Object.keys(records).length > 0, query: domain };
}

async function whoisLookup(target: string): Promise<Record<string, unknown>> {
  const cleanTarget = target.trim().toLowerCase();
  const tld = cleanTarget.split(".").pop() || "";

  const rdapServers: Record<string, string> = {
    com: "https://rdap.verisign.com/com/v1/domain/",
    net: "https://rdap.verisign.com/net/v1/domain/",
    org: "https://rdap.publicinterestregistry.org/rdap/domain/",
    io: "https://rdap.identitydigital.services/rdap/domain/",
    co: "https://rdap.nic.co/domain/",
    dev: "https://rdap.nic.google/domain/",
    app: "https://rdap.nic.google/domain/",
    ai: "https://rdap.nic.ai/domain/",
    ru: "https://rdap.nic.ru/domain/",
    in: "https://rdap.registry.in/domain/",
  };

  const rdapBase = rdapServers[tld];
  if (!rdapBase) {
    return { query: cleanTarget, note: `No RDAP server configured for .${tld} TLD`, available: false };
  }

  try {
    const resp = await fetch(`${rdapBase}${encodeURIComponent(cleanTarget)}`, {
      headers: { "Accept": "application/rdap+json" },
    });
    if (!resp.ok) {
      return { query: cleanTarget, note: `RDAP lookup returned HTTP ${resp.status}`, available: false };
    }
    const data = await resp.json() as Record<string, unknown>;

    const events = (data.events as Array<{ eventAction: string; eventDate: string }>) || [];
    const entities = (data.entities as Array<{ roles: string[]; vcardArray: unknown[] }>) || [];

    const registration = events.find((e) => e.eventAction === "registration");
    const expiration = events.find((e) => e.eventAction === "expiration");
    const lastChanged = events.find((e) => e.eventAction === "last changed");

    const status = (data.status as string[]) || [];
    const nameservers = ((data.nameservers as Array<{ ldhName: string }>) || []).map((n) => n.ldhName);

    const registrarEntity = entities.find((e) => e.roles && e.roles.includes("registrar"));
    let registrarName = "Unknown";
    if (registrarEntity && registrarEntity.vcardArray && Array.isArray(registrarEntity.vcardArray[1])) {
      const vcard = registrarEntity.vcardArray[1] as Array<[string, string, string, string]>;
      const fn = vcard.find((v) => v[0] === "fn");
      if (fn) registrarName = fn[3];
    }

    return {
      query: cleanTarget,
      registrar: registrarName,
      created: registration?.eventDate || null,
      expires: expiration?.eventDate || null,
      updated: lastChanged?.eventDate || null,
      status: status.length > 0 ? status : ["unknown"],
      nameServers: nameservers,
      available: false,
    };
  } catch {
    return { query: cleanTarget, note: "WHOIS/RDAP lookup failed", available: false };
  }
}

async function sslLookup(domain: string): Promise<Record<string, unknown>> {
  try {
    const resp = await fetch(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=false&expand=dns_names&expand=issuer`, {
      headers: { "Accept": "application/json" },
    });
    if (!resp.ok) {
      return { query: domain, note: `Certificate transparency lookup returned HTTP ${resp.status}` };
    }
    const data = await resp.json() as Array<{ id: string; dns_names: string[]; issuer: { name: string; cert_holder_name?: string }; not_before: string; not_after: string }>;
    if (!data || data.length === 0) {
      return { query: domain, note: "No certificates found in transparency logs" };
    }
    const certs = data.slice(0, 5).map((c) => ({
      id: c.id,
      dnsNames: c.dns_names || [],
      issuer: c.issuer?.name || "Unknown",
      validFrom: c.not_before,
      validTo: c.not_after,
    }));
    return { query: domain, certificates: certs, count: certs.length };
  } catch {
    return { query: domain, note: "Certificate transparency lookup failed" };
  }
}

async function headersLookup(url: string): Promise<Record<string, unknown>> {
  try {
    const target = url.startsWith("http") ? url : `https://${url}`;
    const resp = await fetch(target, { method: "GET", redirect: "follow" });
    const headerObj: Record<string, string> = {};
    resp.headers.forEach((value, key) => { headerObj[key] = value });
    return {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      headers: headerObj,
      redirected: resp.redirected,
    };
  } catch (err) {
    return { query: url, note: "HTTP header fetch failed", error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function portsLookup(target: string): Promise<Record<string, unknown>> {
  const commonPorts = [
    { port: 80, service: "HTTP" },
    { port: 443, service: "HTTPS" },
    { port: 22, service: "SSH" },
    { port: 21, service: "FTP" },
    { port: 25, service: "SMTP" },
    { port: 53, service: "DNS" },
    { port: 3306, service: "MySQL" },
    { port: 8080, service: "HTTP-Alt" },
  ];
  const results: Array<{ port: number; service: string; status: string }> = [];
  const hostname = isIP(target) ? target : target.trim();
  const testUrl = isIP(target) ? `https://${hostname}:443` : `https://${hostname}`;

  try {
    const resp = await fetch(testUrl, { method: "GET", redirect: "manual" });
    results.push({ port: 443, service: "HTTPS", status: `open (HTTP ${resp.status})` });
  } catch {
    results.push({ port: 443, service: "HTTPS", status: "closed or unreachable" });
  }
  try {
    const resp = await fetch(`http://${hostname}`, { method: "GET", redirect: "manual" });
    results.push({ port: 80, service: "HTTP", status: `open (HTTP ${resp.status})` });
  } catch {
    results.push({ port: 80, service: "HTTP", status: "closed or unreachable" });
  }
  for (const p of commonPorts.filter((p) => p.port !== 80 && p.port !== 443)) {
    results.push({ port: p.port, service: p.service, status: "not scanned (requires raw socket)" });
  }
  return { target: hostname, scanned: true, openPorts: results.filter((r) => r.status.startsWith("open")), allResults: results, note: "Port scan is limited to HTTP/HTTPS reachability from edge runtime. Full TCP scanning requires a socket-capable server." };
}

async function certificatesLookup(domain: string): Promise<Record<string, unknown>> {
  return sslLookup(domain);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { target, modules } = await req.json() as ReconRequest;

    if (!target || !target.trim()) {
      return new Response(JSON.stringify({ error: "Target is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanTarget = target.trim();
    const isDomainTarget = isDomain(cleanTarget);
    const isIPTarget = isIP(cleanTarget);

    if (!isDomainTarget && !isIPTarget) {
      return new Response(JSON.stringify({ error: "Target must be a valid domain or IP address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedModules = modules && modules.length > 0 ? modules : ["dns", "whois", "ssl"];
    const results: Record<string, unknown> = {};

    const lookupPromises: Array<Promise<void>> = [];

    if (selectedModules.includes("dns") && isDomainTarget) {
      lookupPromises.push(dnsLookup(cleanTarget).then((r) => { results.dns = r }));
    } else if (selectedModules.includes("dns")) {
      results.dns = { note: "DNS lookup is only applicable to domains, not IPs", query: cleanTarget };
    }

    if (selectedModules.includes("whois") && isDomainTarget) {
      lookupPromises.push(whoisLookup(cleanTarget).then((r) => { results.whois = r }));
    } else if (selectedModules.includes("whois")) {
      results.whois = { note: "WHOIS lookup is only applicable to domains, not IPs", query: cleanTarget };
    }

    if (selectedModules.includes("ssl") && isDomainTarget) {
      lookupPromises.push(sslLookup(cleanTarget).then((r) => { results.ssl = r }));
    } else if (selectedModules.includes("ssl")) {
      results.ssl = { note: "SSL/TLS lookup is only applicable to domains, not IPs", query: cleanTarget };
    }

    if (selectedModules.includes("ports")) {
      lookupPromises.push(portsLookup(cleanTarget).then((r) => { results.ports = r }));
    }

    if (selectedModules.includes("headers")) {
      lookupPromises.push(headersLookup(cleanTarget).then((r) => { results.headers = r }));
    }

    if (selectedModules.includes("certificates") && isDomainTarget) {
      lookupPromises.push(certificatesLookup(cleanTarget).then((r) => { results.certificates = r }));
    } else if (selectedModules.includes("certificates")) {
      results.certificates = { note: "Certificate lookup is only applicable to domains, not IPs", query: cleanTarget };
    }

    await Promise.all(lookupPromises);

    return new Response(JSON.stringify({
      target: cleanTarget,
      modules: selectedModules,
      results,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Recon lookup failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
