<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use App\Models\Concerns\CustomerScoped;

class DeviceEvent extends Model
{
    use CustomerScoped;

    public function scopeForCustomer(Builder $query, int $customerId): Builder
    {
        return $query->whereHas('device.site', fn (Builder $q) => $q->where('customer_id', $customerId));
    }

    protected $fillable = [
        'device_id', 'source_log_id', 'type', 'severity', 'value', 'message', 'occurred_at',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
    ];

    public function device()
    {
        return $this->belongsTo(Device::class);
    }
}
