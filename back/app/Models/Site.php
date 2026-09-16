<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Site extends Model
{
    protected $fillable = [
        'customer_id', 'name', 'address', 'timezone', 'auto_provisioned',
        'contact_name', 'contact_phone', 'lat', 'lng',
    ];

    protected $casts = [
        'auto_provisioned' => 'boolean',
        'lat' => 'float',
        'lng' => 'float',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function devices()
    {
        return $this->hasMany(Device::class);
    }

    public function getDevicesCountAttribute(): int
    {
        return $this->devices()->count();
    }
}
