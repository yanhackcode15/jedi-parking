require 'faye'
Faye::WebSocket.load_adapter('thin')
faye_server = Faye::RackAdapter.new(:mount => '/faye', :timeout => 45)
Faye.logger = lambda { |m| puts m }
run faye_server