<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeviceModel extends Model
{
    protected $fillable = [
        'name', 'mcu', 'ota_capable',
        'manufacturer', 'min_firmware', 'description',
    ];

    protected $casts = [
        'ota_capable' => 'boolean',
    ];

    public function devices()
    {
        return $this->hasMany(Device::class, 'model_id');
    }

    public function getDevicesCountAttribute(): int
    {
        return $this->devices()->count();
    }
}
