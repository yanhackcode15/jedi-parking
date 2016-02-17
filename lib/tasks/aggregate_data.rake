namespace :aggregate_data do
  desc "Pull sensor data from SM parking API"
  task pull_sensor_data: :environment do
  	current_time = (Time.now-1.hours).utc.iso8601(0).to_s
    binding.pry
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
      m
    end


	
  end

end
