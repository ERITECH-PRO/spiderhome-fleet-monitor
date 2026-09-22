<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\CustomerScoped;

class Alert extends Model
{
    use CustomerScoped;

    public function scopeForCustomer(Builder $query, int $customerId): Builder
    {
        return $query->whereHas('device.site', fn (Builder $q) => $q->where('customer_id', $customerId));
    }

    protected $fillable = [
        'device_id', 'type', 'severity', 'priority', 'message', 'diagnostic', 'status',
        'acknowledged_by', 'acknowledged_at', 'resolved_at', 'owner_id',
        'first_occurred_at', 'last_occurred_at', 'occurrences',
    ];

    protected $casts = [
        'acknowledged_at'   => 'datetime',
        'resolved_at'       => 'datetime',
        'first_occurred_at' => 'datetime',
        'last_occurred_at'  => 'datetime',
        'occurrences'       => 'integer',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    // Scopes
    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    public function scopeCritical($query)
    {
        return $query->where('severity', 'critical');
    }
}
