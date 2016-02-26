class MapsController < ApplicationController
	def index
		#return the map center x, y
		@address = params[:address]		
	end

	def create
	end

	def new
	end

private

end
