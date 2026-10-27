var maximumImageBytes = 2 * 1024 * 1024;
var allowedContentTypes = {
  'image/jpeg': function(data) {
    return data.length >= 3 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff;
  },
  'image/png': function(data) {
    return data.length >= 8 &&
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  },
  'image/gif': function(data) {
    var signature = data.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  },
  'image/webp': function(data) {
    return data.length >= 12 &&
      data.subarray(0, 4).toString('ascii') === 'RIFF' &&
      data.subarray(8, 12).toString('ascii') === 'WEBP';
  }
};

function decodeImageUpload(upload) {
  if (!upload || typeof upload !== 'object' || Array.isArray(upload) ||
      typeof upload.contentType !== 'string' || typeof upload.data !== 'string') {
    return { error: 'Selecciona un archivo de imagen valido.' };
  }

  var hasValidType = Object.prototype.hasOwnProperty.call(allowedContentTypes, upload.contentType);
  var maximumBase64Length = Math.ceil(maximumImageBytes / 3) * 4;
  if (!hasValidType || !upload.data || upload.data.length > maximumBase64Length) {
    return { error: 'Usa una imagen JPEG, PNG, GIF o WebP de hasta 2 MB.' };
  }

  var data = Buffer.from(upload.data, 'base64');
  if (data.length > maximumImageBytes ||
      data.toString('base64') !== upload.data ||
      !allowedContentTypes[upload.contentType](data)) {
    return { error: 'El archivo no es una imagen valida o supera el limite de 2 MB.' };
  }
  return {
    value: {
      data: data,
      contentType: upload.contentType
    }
  };
}

module.exports = {
  decodeImageUpload: decodeImageUpload,
  maximumImageBytes: maximumImageBytes
};
