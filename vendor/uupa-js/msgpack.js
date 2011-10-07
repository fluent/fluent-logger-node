// MessagePack.pack for javascript

// Original
// http://uupaa-js.googlecode.com/svn/trunk/0.8/src/misc/msgpack.js

module.exports = {
  pack: function(data){
    return encode([], data);
  }
};

var _split8char = /.{8}/g;
var _bit2num    = {}; // BitStringToNumber      { "00000000": 0, ... "11111111": 255 }
for (var i=0; i < 0x100; ++i) {
  _bit2num[("0000000" + i.toString(2)).slice(-8)] = i;
}

// inner - encoder
function encode(rv,    // @param ByteArray: result
                mix) { // @param Mix: source data
  var size = 0, i = 0, iz, c, ary, hash,
      high, low, i64 = 0, sign, exp, frac;

      if (mix == null) { // null or undefined
        rv.push(0xc0);
      } else {
        switch (typeof mix) {
        case "boolean":
          rv.push(mix ? 0xc3 : 0xc2);
          break;
        case "number":
          if (mix !== mix) { // isNaN
            rv.push(0xcb, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff); // quiet NaN
          } else if (mix === Infinity) {
            rv.push(0xcb, 0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // positive infinity
          } else if (Math.floor(mix) === mix) {
            if (mix < 0) { // int
              if (mix >= -32) { // negative fixnum
                rv.push(0xe0 + mix + 32);
              } else if (mix > -0x80) {
                rv.push(0xd0, mix + 0x100);
              } else if (mix > -0x8000) {
                mix += 0x10000;
                rv.push(0xd1, mix >> 8, mix & 0xff);
              } else if (mix > -0x80000000) {
                mix += 0x100000000;
                rv.push(0xd2, mix >>> 24, (mix >> 16) & 0xff,
                        (mix >>  8) & 0xff, mix & 0xff);
              } else {
                ++i64;
              }
            } else { // uint
              if (mix < 0x80) {
                rv.push(mix); // positive fixnum
              } else if (mix < 0x100) { // uint 8
                rv.push(0xcc, mix);
              } else if (mix < 0x10000) { // uint 16
                rv.push(0xcd, mix >> 8, mix & 0xff);
              } else if (mix < 0x100000000) { // uint 32
                rv.push(0xce, mix >>> 24, (mix >> 16) & 0xff,
                        (mix >>  8) & 0xff, mix & 0xff);
              } else {
                ++i64;
              }
            }
            if (i64) {
              high = Math.floor(mix / 0x100000000);
              low = mix & (0x100000000 - 1);
              rv.push(mix < 0 ? 0xd3 : 0xcf,
                      (high >> 24) & 0xff, (high >> 16) & 0xff,
                      (high >>  8) & 0xff,         high & 0xff,
                      (low  >> 24) & 0xff, (low  >> 16) & 0xff,
                      (low  >>  8) & 0xff,          low & 0xff);
            }
          } else { // double
            // THX! edvakf
            // http://javascript.g.hatena.ne.jp/edvakf/20100614/1276503044
            hash = _bit2num;
            sign = mix < 0;
            sign && (mix *= -1);

            // add offset 1023 to ensure positive
            exp  = Math.log(mix) / Math.LN2 + 1023 | 0;

            // shift 52 - (exp - 1023) bits to make integer part exactly 53 bits,
            // then throw away trash less than decimal point
            frac = (Math.floor(mix * Math.pow(2, 52 + 1023 - exp))).
              toString(2).slice(1);

            // exp is between 1 and 2047. make it 11 bits
            exp  = ("000000000" + exp.toString(2)).slice(-11);

            ary  = (+sign + exp + frac).match(_split8char);
            rv.push(0xcb, hash[ary[0]], hash[ary[1]],
                    hash[ary[2]], hash[ary[3]],
                    hash[ary[4]], hash[ary[5]],
                    hash[ary[6]], hash[ary[7]]);
          }
          break;
        case "string":
          // utf8.encode
          for (ary = [], iz = mix.length, i = 0; i < iz; ++i) {
            c = mix.charCodeAt(i);
            if (c < 0x80) { // ASCII(0x00 ~ 0x7f)
              ary.push(c & 0x7f);
            } else if (c < 0x0800) {
              ary.push(((c >>>  6) & 0x1f) | 0xc0, (c & 0x3f) | 0x80);
            } else if (c < 0x10000) {
              ary.push(((c >>> 12) & 0x0f) | 0xe0,
                       ((c >>>  6) & 0x3f) | 0x80, (c & 0x3f) | 0x80);
            }
          }
          setType(rv, 32, ary.length, [0xa0, 0xda, 0xdb]);
          Array.prototype.push.apply(rv, ary);
          break;
        default: // array or hash
          if (Object.prototype.toString.call(mix) === "[object Array]") { // array
            size = mix.length;
            setType(rv, 16, size, [0x90, 0xdc, 0xdd]);
            for (; i < size; ++i) {
              encode(rv, mix[i]);
            }
          } else { // hash
            if (Object.keys) {
              size = Object.keys(mix).length;
            } else {
              for (i in mix) {
                mix.hasOwnProperty(i) && ++size;
              }
            }
            setType(rv, 16, size, [0x80, 0xde, 0xdf]);
            for (i in mix) {
              encode(rv, i);
              encode(rv, mix[i]);
            }
          }
        }
      }
  return rv;
}

// inner - set type and fixed size
function setType(rv,      // @param ByteArray: result
                 fixSize, // @param Number: fix size. 16 or 32
                 size,    // @param Number: size
                 types) { // @param ByteArray: type formats. eg: [0x90, 0xdc, 0xdd]
  if (size < fixSize) {
    rv.push(types[0] + size);
  } else if (size < 0x10000) { // 16
    rv.push(types[1], size >> 8, size & 0xff);
  } else if (size < 0x100000000) { // 32
    rv.push(types[2], size >>> 24, (size >> 16) & 0xff,
            (size >>  8) & 0xff, size & 0xff);
  }
}
