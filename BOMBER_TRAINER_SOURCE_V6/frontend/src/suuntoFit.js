const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);

const TYPE_FIELD_NAMES = {
    0: 'position_lat',
    1: 'position_long',
    2: 'altitude',
    3: 'heart_rate',
    4: 'cadence',
    5: 'distance',
    6: 'speed',
    7: 'power',
    8: 'compressed_speed_distance',
    9: 'grade',
    10: 'resistance',
    11: 'time_from_course',
    12: 'cycle_length',
    13: 'temperature',
    14: 'activity_type',
};

const decodeBaseType = (baseType) => ({
    0: { size: 1, type: 'enum' },
    1: { size: 1, type: 'sint8' },
    2: { size: 1, type: 'uint8' },
    3: { size: 2, type: 'sint16' },
    4: { size: 2, type: 'uint16' },
    5: { size: 4, type: 'sint32' },
    6: { size: 4, type: 'uint32' },
    7: { size: 4, type: 'float32' },
    8: { size: 4, type: 'float64' },
    9: { size: 8, type: 'uint64' },
    10: { size: 8, type: 'sint64' },
    11: { size: 3, type: 'uint24' },
    12: { size: 2, type: 'uint16z' },
    13: { size: 4, type: 'uint32z' },
    14: { size: 1, type: 'byte' },
    15: { size: 2, type: 'sint16z' },
    16: { size: 4, type: 'sint32z' },
});

const readPrimitive = (view, offset, baseType, littleEndian) => {
    const info = decodeBaseType(baseType & 0x1f);
    if (!info) return { value: null, size: 1 };
    const type = info.type;
    if (type === 'enum' || type === 'uint8' || type === 'byte') return { value: view.getUint8(offset), size: 1 };
    if (type === 'sint8') return { value: view.getInt8(offset), size: 1 };
    if (type === 'sint16') return { value: view.getInt16(offset, littleEndian), size: 2 };
    if (type === 'uint16' || type === 'uint16z') return { value: view.getUint16(offset, littleEndian), size: 2 };
    if (type === 'sint16z') return { value: view.getInt16(offset, littleEndian), size: 2 };
    if (type === 'sint32') return { value: view.getInt32(offset, littleEndian), size: 4 };
    if (type === 'uint32' || type === 'uint32z') return { value: view.getUint32(offset, littleEndian), size: 4 };
    if (type === 'sint32z') return { value: view.getInt32(offset, littleEndian), size: 4 };
    if (type === 'float32') return { value: view.getFloat32(offset, littleEndian), size: 4 };
    if (type === 'float64') return { value: view.getFloat64(offset, littleEndian), size: 8 };
    if (type === 'uint24') {
        const b0 = view.getUint8(offset); const b1 = view.getUint8(offset + 1); const b2 = view.getUint8(offset + 2);
        return { value: littleEndian ? b0 | (b1 << 8) | (b2 << 16) : (b0 << 16) | (b1 << 8) | b2, size: 3 };
    }
    if (type === 'uint64' || type === 'sint64') {
        const value = type === 'uint64'
            ? view.getBigUint64(offset, littleEndian)
            : view.getBigInt64(offset, littleEndian);
        return { value: Number(value), size: 8 };
    }
    return { value: null, size: info.size };
};

const scaleValue = (value, field) => {
    if (value === null || value === undefined) return null;
    if (field.name === 'heart_rate') return Number(value);
    if (field.name === 'distance') return Number(value) / 100;
    if (field.name === 'speed') return Number(value) / 1000;
    if (field.name === 'altitude') return (Number(value) / 5) - 500;
    if (field.name === 'position_lat' || field.name === 'position_long') return Number(value) * (180 / 2147483648);
    if (field.name === 'timestamp') return FIT_EPOCH_MS + (Number(value) * 1000);
    return Number(value);
};

function parseFit(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 14) throw new Error('Fitxer FIT massa petit.');
    const headerSize = view.getUint8(0);
    const dataSize = view.getUint32(4, true);
    const start = headerSize;
    const end = Math.min(view.byteLength, start + dataSize);
    const defs = new Map();
    const records = [];
    let offset = start;

    while (offset < end) {
        const recordHeader = view.getUint8(offset++);
        const compressed = (recordHeader & 0x80) !== 0;
        const localId = compressed ? ((recordHeader >> 5) & 0x03) : (recordHeader & 0x0f);
        if (compressed) {
            const timeOffset = recordHeader & 0x1f;
            const def = defs.get(localId);
            if (!def) continue;
            const obj = readDataMessage(view, offset, def, true);
            offset = obj.offset;
            if (obj.record) { obj.record.timestampOffset = timeOffset; records.push(obj.record); }
            continue;
        }
        const isDefinition = (recordHeader & 0x40) !== 0;
        if (isDefinition) {
            offset += 1; // reserved
            const architecture = view.getUint8(offset++);
            const littleEndian = architecture === 0;
            const globalMessage = view.getUint16(offset, littleEndian); offset += 2;
            const fieldCount = view.getUint8(offset++);
            const fields = [];
            for (let i = 0; i < fieldCount; i += 1) {
                const fieldNum = view.getUint8(offset++);
                const size = view.getUint8(offset++);
                const baseType = view.getUint8(offset++);
                fields.push({ fieldNum, size, baseType, name: fieldNum === 253 && globalMessage === 20 ? 'timestamp' : TYPE_FIELD_NAMES[fieldNum] });
            }
            const devCount = view.getUint8(offset++);
            offset += devCount * 3;
            defs.set(localId, { globalMessage, fields, littleEndian });
        } else {
            const def = defs.get(localId);
            if (!def) break;
            const obj = readDataMessage(view, offset, def, false);
            offset = obj.offset;
            if (obj.record && (def.globalMessage === 20 || def.globalMessage === 18)) records.push(obj.record);
        }
    }
    return records.filter((r) => Object.keys(r).length > 0);
}

function readDataMessage(view, offset, def) {
    const record = {};
    for (const field of def.fields) {
        const info = decodeBaseType(field.baseType & 0x1f);
        const size = field.size || info?.size || 1;
        if (offset + size > view.byteLength) return { offset: view.byteLength, record: null };
        const raw = readPrimitive(view, offset, field.baseType, def.littleEndian).value;
        offset += size;
        if (!field.name) continue;
        record[field.name] = scaleValue(raw, field);
    }
    return { offset, record };
}

export async function parseSuuntoFit(file) {
    const buffer = await file.arrayBuffer();
    const records = parseFit(buffer);
    const heartRates = records.map((r) => r.heart_rate).filter((v) => Number.isFinite(v) && v > 0 && v < 250);
    const timestamps = records.map((r) => r.timestamp).filter((v) => Number.isFinite(v));
    if (!heartRates.length) throw new Error('No he trobat freqüència cardíaca al FIT. Comprova que el Suunto hagi enregistrat la FC.');
    const avg = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
    const max = Math.max(...heartRates);
    const start = timestamps.length ? Math.min(...timestamps) : null;
    const end = timestamps.length ? Math.max(...timestamps) : null;
    const durationSeconds = start && end ? Math.max(0, (end - start) / 1000) : 0;
    const zones = [
        { name: 'Z1', min: 0, max: 0.6 },
        { name: 'Z2', min: 0.6, max: 0.7 },
        { name: 'Z3', min: 0.7, max: 0.8 },
        { name: 'Z4', min: 0.8, max: 0.9 },
        { name: 'Z5', min: 0.9, max: 1.1 },
    ]; 
    return {
        source: 'suunto_fit',
        fileName: file.name,
        importedAt: new Date().toISOString(),
        date: start ? new Date(start).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        durationSeconds,
        heartRate: { average: Math.round(avg), max, samples: heartRates.length },
        zonesByMaxHr: zones.map((zone) => ({
            zone: zone.name,
            seconds: Math.round(heartRates.filter((hr) => (hr / max) >= zone.min && (hr / max) < zone.max).length * (durationSeconds / Math.max(1, heartRates.length))),
        })),
    };
}
