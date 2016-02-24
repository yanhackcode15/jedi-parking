namespace :aggregate_data do
  desc "Pull sensor data from SM parking API"
  task pull_sensor_data: :environment do
    current_time = (Time.now-1.hours).utc.iso8601(0).to_s
    EM.run {
      # binding.pry
      # client = Faye::Client.new('http://localhost:9292/faye')
      url = 'http://jedi-parking.herokuapp.com:'+$PORT+'/faye'
      client = Faye::Client.new(url)

      temp1 = current_time.split('-')
      temp2 = temp1[2].split(':')
      temp1[2]=temp2.join()
      t=temp1.join()
      uri = "https://parking.api.smgov.net/meters/events/since/" + t
      response = HTTParty.get(uri)
      meter_data = JSON.parse(response.body)
      meters = meter_data.map do |meter|
        m = Meter.find_by(meter_id: meter['meter_id'])
        if (m.event_time==nil || (m.event_time<=>meter['event_time'])==-1)
          m.event_type = meter['event_type']  
          m.event_time = meter['event_time']
          m.save
        end

        publication = client.publish("/meters/update", {
          'meter_id' => meter['meter_id'],
          'event_type' => meter['event_type'],
          'event_time' => meter['event_time']
        })

        publication.callback do
          puts 'Socket success'
          # EM.stop
        end

        publication.errback do |error|
          puts 'Socket error: ' + error.message
        end

        client.on 'transport:down' do
          puts 'Socket error: Connection down'
        end

      end

    }
  end

end
