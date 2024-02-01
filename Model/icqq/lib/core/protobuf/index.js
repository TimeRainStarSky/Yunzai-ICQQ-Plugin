"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodePb = exports.decode = exports.encode = exports.Proto = void 0;
// import * as pb from "protobufjs"
const protobuf_min_js_1 = __importDefault(require("./protobuf.min.js"));
const zlib = __importStar(require("zlib"));
class Proto {
    get length() {
        return this.encoded.length;
    }
    constructor(encoded, decoded) {
        this.encoded = encoded;
        if (decoded)
            Reflect.setPrototypeOf(this, decoded);
    }
    toString() {
        return this.encoded.toString();
    }
    toHex() {
        return this.encoded.toString("hex");
    }
    toBase64() {
        return this.encoded.toString("base64");
    }
    toBuffer() {
        return this.encoded;
    }
    toJSON() {
        const toJSON = (pb) => {
            if (!(pb instanceof Proto))
                return pb;
            const keys = Object.keys(pb);
            if (keys.length === 1 && keys[0] === 'encoded') {
                try {
                    pb = decode(pb.encoded);
                }
                catch {
                    return pb.encoded.toString();
                }
            }
            if (!pb)
                return pb;
            const result = {};
            for (const k of Object.keys(pb)) {
                if (!/^\d+$/.test(k))
                    continue;
                const key = Number(k);
                if (Array.isArray(pb[key]))
                    return pb[key].map(toJSON);
                else if (pb[key] instanceof Proto)
                    result[key] = pb[key].toJSON();
                else if (pb[key] && typeof pb[key] === "object")
                    result[key] = toJSON(pb[key]);
                else if (Buffer.isBuffer(pb[key]))
                    result[key] = pb[key].toString("hex");
                else
                    result[key] = pb[key];
            }
            return result;
        };
        return toJSON(this);
    }
    [Symbol.toPrimitive]() {
        return this.toString();
    }
}
exports.Proto = Proto;
function _encode(writer, tag, value) {
    if (value === null || value === undefined)
        return;
    let type = 2;
    if (typeof value === "number") {
        type = Number.isInteger(value) ? 0 : 1;
    }
    else if (typeof value === "string") {
        value = Buffer.from(value);
    }
    else if (value instanceof Uint8Array) {
        //
    }
    else if (value instanceof Proto) {
        value = value.toBuffer();
    }
    else if (typeof value === "object") {
        value = encode(value);
    }
    else if (typeof value === "bigint") {
        const tmp = new protobuf_min_js_1.default.util.Long();
        tmp.unsigned = false;
        tmp.low = Number(value & 0xffffffffn);
        tmp.high = Number((value & 0xffffffff00000000n) >> 32n);
        value = tmp;
        type = 0;
    }
    else {
        return;
    }
    const head = tag << 3 | type;
    writer.uint32(head);
    switch (type) {
        case 0:
            if (value < 0)
                writer.sint64(value);
            else
                writer.int64(value);
            break;
        case 2:
            writer.bytes(value);
            break;
        case 1:
            writer.double(value);
            break;
    }
}
function encode(obj) {
    Reflect.setPrototypeOf(obj, null);
    const writer = new protobuf_min_js_1.default.Writer();
    for (const tag of Object.keys(obj).map(Number)) {
        const value = obj[tag];
        if (Array.isArray(value)) {
            for (let v of value)
                _encode(writer, tag, v);
        }
        else {
            _encode(writer, tag, value);
        }
    }
    return writer.finish();
}
exports.encode = encode;
function long2int(long) {
    if (long.high === 0)
        return long.low >>> 0;
    const bigint = (BigInt(long.high) << 32n) | (BigInt(long.low) & 0xffffffffn);
    const int = Number(bigint);
    return Number.isSafeInteger(int) ? int : bigint;
}
function decode(encoded) {
    const result = new Proto(encoded);
    const reader = new protobuf_min_js_1.default.Reader(encoded);
    while (reader.pos < reader.len) {
        const k = reader.uint32();
        const tag = k >> 3, type = k & 0b111;
        let value, decoded;
        switch (type) {
            case 0:
                value = long2int(reader.int64());
                break;
            case 1:
                value = long2int(reader.fixed64());
                break;
            case 2:
                value = Buffer.from(reader.bytes());
                try {
                    decoded = decode(value);
                }
                catch { }
                value = new Proto(value, decoded);
                break;
            case 5:
                value = reader.fixed32();
                break;
            default:
                return null;
        }
        if (Array.isArray(result[tag])) {
            result[tag].push(value);
        }
        else if (Reflect.has(result, tag)) {
            result[tag] = [result[tag]];
            result[tag].push(value);
        }
        else {
            result[tag] = value;
        }
    }
    return result;
}
exports.decode = decode;
function decodePb(buffer_data) {
    let pb = {
        decode,
        encode
    };
    let proto = pb.decode(buffer_data);
    let json = {};
    let data;
    //delete proto;
    //console.log("小叶子调试",pb.decode(proto[3][1][2][1][1][1]));
    let index = 0;
    async function decode2(proto, json) {
        for (let key in proto) {
            if (key == "encoded") {
                continue;
            }
            if (proto[key] instanceof Object) {
                if (proto[key] instanceof Array) {
                    json[key] = [];
                    for (let i = 0; i < proto[key].length; i++) {
                        json[key].push({});
                        decode2(proto[key][i], json[key][i]);
                    }
                }
                else {
                    try {
                        if (pb.decode(proto[key].encoded) == null) {
                            if (data.length > 3) {
                                let Prefix = "";
                                if (data[0] == 0x01 || data[0] == 0x00) {
                                    Prefix = data.toString("hex").slice(0, 2);
                                    data = data.slice(1);
                                }
                                let data_json = {};
                                data_json.Prefix = Prefix;
                                if (data[0] == 0x78 && data[1] == 0x9c) {
                                    let Deflatedata = zlib.unzipSync(data);
                                    // data_json.RawData = proto[key].encoded;
                                    // data_json.DecompressedData =Deflatedata;
                                    // data_json.CompressType = "Deflate"
                                    data_json.txt = Deflatedata.toString();
                                    data_json.tip = "数据被加密过,使用时请把数据加密回去 deflateSync()";
                                    json[key] = data_json;
                                    decode2(proto[key], json[key]);
                                    continue;
                                }
                                else {
                                    json[key] = proto[key].encoded.toString();
                                    decode2(proto[key], json[key]);
                                    continue;
                                }
                            }
                            json[key] = proto[key].encoded.toString();
                            decode2(proto[key], json[key]);
                            continue;
                        }
                        json[key] = {};
                        decode2(proto[key], json[key]);
                    }
                    catch (error) {
                        data = proto[key].encoded;
                        if (data.length > 3) {
                            let Prefix = "";
                            if (data[0] == 0x01 || data[0] == 0x00) {
                                Prefix = data.toString("hex").slice(0, 2);
                                data = data.slice(1);
                            }
                            let data_json = {};
                            data_json.Prefix = Prefix;
                            if (data[0] == 0x78 && data[1] == 0x9c) {
                                let Deflatedata = zlib.unzipSync(data);
                                // data_json.RawData = proto[key].encoded;
                                // data_json.DecompressedData =Deflatedata;
                                // data_json.CompressType = "Deflate"
                                data_json.txt = Deflatedata.toString();
                                data_json.tip = "数据被加密过,使用时请把数据加密回去 deflateSync()";
                                json[key] = data_json;
                                decode2(proto[key], json[key]);
                                continue;
                            }
                            else {
                                json[key] = proto[key].encoded.toString();
                                decode2(proto[key], json[key]);
                                continue;
                            }
                        }
                        json[key] = proto[key].encoded.toString();
                        decode2(proto[key], json[key]);
                        continue;
                    }
                }
            }
            else {
                //console.log("小叶子调试",proto[key]);
                let value = proto[key];
                if (typeof value == "bigint") {
                    value = value.toString();
                    value = Number(value);
                }
                json[key] = value;
            }
        }
    }
    decode2(proto, json);
    return json;
}
exports.decodePb = decodePb;
