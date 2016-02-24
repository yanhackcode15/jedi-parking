class ApplicationController < ActionController::Base
  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception
  def index
  	@url = 'http://jedi-parking.herokuapp.com:'+$PORT+'/faye/client.js'
  end
end
