var path = require('path'),
    Command = require('jasmine/lib/command.js'),
    Jasmine = require('jasmine/lib/jasmine.js');

var jasmine = new Jasmine({ projectBaseDir: path.resolve() });
var examplesDir = path.join(__dirname, '..', 'node_modules', 'jasmine-core', 'lib', 'jasmine-core', 'example', 'node_example');
var command = new Command(path.resolve(), examplesDir, console.log);

command.run(jasmine, []);
