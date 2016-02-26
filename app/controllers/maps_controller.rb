class MapsController < ApplicationController
	def index
		#return the map center x, y
		@address = params[:address]
		@websocket_end_point = Rails.configuration.x.websocket_end_point
		
	end

	def create
	end

	def new
	end

private

end
