<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use App\Models\Concerns\CustomerScoped;

class Site extends Model
{
    use CustomerScoped;

    public function scopeForCustomer(Builder $query, int $customerId): Builder
    {
        return $query->where('customer_id', $customerId);
    }
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
