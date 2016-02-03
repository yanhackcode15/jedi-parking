class MetersController < ApplicationController
	def index
		@result = Meter.all
		render json: @result

	end

	def show
	end
end
