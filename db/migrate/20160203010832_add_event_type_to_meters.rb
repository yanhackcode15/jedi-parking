class AddEventTypeToMeters < ActiveRecord::Migration
  def change
    add_column :meters, :event_type, :string
  end
end
