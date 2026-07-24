require 'webrick'
root = File.expand_path('.', __dir__)
server = WEBrick::HTTPServer.new(Port: 3400, DocumentRoot: root,
  Logger: WEBrick::Log.new('/dev/null'),
  AccessLog: [])
trap('INT') { server.shutdown }
server.start
