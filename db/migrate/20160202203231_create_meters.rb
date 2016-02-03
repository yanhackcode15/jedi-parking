class CreateMeters < ActiveRecord::Migration
  def change
    create_table :meters do |t|
    	t.text :address
    	t.string :area
    	t.boolean	:active
    	t.decimal	:latitude, :longitude, scale: 6, precision: 9
    	t.string :meter_id

      t.timestamps null: false
    end
  end
end
