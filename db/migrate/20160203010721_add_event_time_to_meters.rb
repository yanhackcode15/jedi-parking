class AddEventTimeToMeters < ActiveRecord::Migration
  def change
    add_column :meters, :event_time, :string
  end
end
