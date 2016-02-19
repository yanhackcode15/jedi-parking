class Meter < ActiveRecord::Base
#comment
	validates :meter_id, :uniqueness => true

	def self.save_meter_data_from_api
		response = HTTParty.get('http://parking.api.smgov.net/meters/')
    meter_data = JSON.parse(response.body)
    meters = meter_data.map do |meter|
      m = Meter.new
      m.meter_id = meter['meter_id']
      # m.address = meter['stree_address']
      m.area = meter['area']
      m.active = meter['active']
      m.latitude = meter['latitude']
      m.longitude = meter['longitude']
      m.address = meter['street_address']
      # set name value however you want to do that
      m.save
      m
    end
    meters.select(&:persisted?)

	end

	def self.add_address_into_meter
		response = HTTParty.get('http://parking.api.smgov.net/meters/')
    meter_data = JSON.parse(response.body)
    meters = meter_data.map do |meter|
    	m = Meter.find_by(meter_id: meter['meter_id'])   
      m.address = meter['street_address']
      m.save
      m
    end
    meters.select(&:persisted?)
	end

	def self.initial_add_sensor_data
    current_time = (Time.now-1.hours).utc.iso8601(0).to_s
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

    
		# response = HTTParty.get('https://parking.api.smgov.net/meters/events/since/20160202T230000Z/')
  #   meter_data = JSON.parse(response.body)
  #   meters = meter_data.map do |meter|
  #     m = Meter.find_by(meter_id: meter['meter_id']) 
  #     # if m.event_time!=null && m.event_time<meter['event_time']
	 #      m.event_type = meter['event_type']  
	 #      m.event_time = meter['event_time']
	 #      m.save
	 #    # end
  #     m
  #   end
	end
end
