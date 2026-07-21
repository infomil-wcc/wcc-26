import { promises as fs } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import zlib from 'zlib';

/**
 * Normalizes date strings to explicit Mauritian Timezone (+04:00) 
 * if no timezone descriptor is present.
 */
export function parseMauritianDate(dateStr) {
  if (!dateStr) return 0;
  let normalized = String(dateStr).trim();

  // Cross-browser/environment standard replacement
  normalized = normalized.replace(' ', 'T');
  return new Date(normalized).getTime();
}

export function convertDirectusToMauritianString(dateStr) {
  if (!dateStr) return '';
  let normalized = String(dateStr).trim();
  if (!normalized.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }
  const d = new Date(normalized);
  d.setUTCHours(d.getUTCHours() + 4);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * Returns the current server time strictly formatted as an ISO string with the Mauritian timezone offset (+04:00).
 * Example: '2026-06-15T18:00:00+04:00'
 */
export function getCurrentMauritianDateStr() {
  const now = new Date();
  
  // Calculate Mauritian time (+4 hours from UTC)
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const muMs = utcMs + (4 * 3600000);
  const muDate = new Date(muMs);

  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = muDate.getFullYear();
  const MM = pad(muDate.getMonth() + 1);
  const DD = pad(muDate.getDate());
  const hh = pad(muDate.getHours());
  const mm = pad(muDate.getMinutes());
  const ss = pad(muDate.getSeconds());

  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}+04:00`;
}

/**
 * Handles CORS preflight requests.
 * @param {object} request - The request object.
 * @param {object} response - The response object.
 * @returns {boolean} - True if the request was an OPTIONS request and handled, false otherwise.
 */
export function handleCors(request, response) {
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return true;
  }
  return false;
}

/**
 * Reads and parses a JSON file from the 'data' directory.
 * @param {string} fileName - The name of the JSON file (e.g., 'squads-data.json').
 * @returns {Promise<object>} - A promise that resolves to the parsed JSON object.
 * @throws {Error} - If the file cannot be read or parsed.
 */
export async function readJsonFile(fileName) {
  const filePath = path.join(process.cwd(), 'data', fileName);
  const fileContents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
}

/**
 * Applies filters and selection logic to a dataset.
 * @param {Array<object>} data - The array of data objects to filter and select from.
 * @param {object} query - The request query object containing 'select' and filter parameters.
 * @param {string} [defaultKeyForMap] - A key to include in the mapped result when 'select' is used and multiple items are returned.
 * @returns {object} - An object containing the filtered/selected data and metadata.
 */
export function applyFiltersAndSelect(data, query, defaultKeyForMap = 'name') {
  const { select, ...filters } = query;
  const filterKeys = Object.keys(filters);

  let result = data;

  if (filterKeys.length > 0) {
    result = data.filter(item => {
      return filterKeys.every(key => {
        if (item[key] === undefined) return false;
        if (typeof item[key] === 'string') {
          return item[key].toLowerCase() === filters[key].toLowerCase();
        }
        return item[key] == filters[key];
      });
    });
  }

  if (result.length === 0) {
    return { status: 404, data: { error: 'No elements match the provided filters.' } };
  }

  if (select) {
    if (result.length === 1) {
      return { status: 200, data: result[0][select] !== undefined ? result[0][select] : { error: `Property '${select}' not found.` } };
    }
    return {
      status: 200,
      data: result.map(item => {
        const mappedItem = {};
        if (item[defaultKeyForMap] !== undefined) {
          mappedItem[defaultKeyForMap] = item[defaultKeyForMap];
        }
        mappedItem[select] = item[select];
        return mappedItem;
      })
    };
  }

  return { status: 200, data: result };
}

const rejectUnauthorizedAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false
});

/**
 * Custom fetch helper that uses Node's native https/http modules
 * with rejectUnauthorized: false to bypass TLS errors.
 */
export function fetchWithBypass(url, options = {}) {
  const isHttps = url.toLowerCase().startsWith('https:');
  const client = isHttps ? https : http;
  const method = options.method || 'GET';

  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const reqOpts = {
      method: method,
      headers: headers,
      rejectUnauthorized: false,
      agent: isHttps ? rejectUnauthorizedAgent : undefined
    };

    const req = client.request(url, reqOpts, (res) => {
      let stream = res;
      const contentEncoding = res.headers['content-encoding'];
      if (contentEncoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (contentEncoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }

      let chunks = [];
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const data = buffer.toString('utf8');
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          json: async () => JSON.parse(data),
          text: async () => data,
          buffer: async () => buffer,
          arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        });
      });
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error('Timeout'));
    });

    req.on('error', (err) => {
      console.error(`[fetchWithBypass] ERROR: ${method} ${url} - ${err.message}`);
      reject(err);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

