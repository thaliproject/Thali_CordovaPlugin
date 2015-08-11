var errArg;
var fileLocationArg;

function MobileGetDocumentsPath() {
  return;
}

MobileGetDocumentsPath.storeGetDocumentsPathReturnArguments = function () {
  errArg = arguments[0];
  fileLocationArg = arguments[1];
};

MobileGetDocumentsPath.GetDocumentsPath = function (cb) {
  cb(errArg, fileLocationArg);
};

global.Mobile = MobileGetDocumentsPath;
