<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceRequest extends Model
{
    // ── Statuts valides ────────────────────────────────────────────────────────
    const STATUS_OPEN        = 'open';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_RESOLVED    = 'resolved';
    const STATUS_CLOSED      = 'closed';
    const STATUS_CANCELLED   = 'cancelled';

    const STATUSES = [
        self::STATUS_OPEN,
        self::STATUS_IN_PROGRESS,
        self::STATUS_RESOLVED,
        self::STATUS_CLOSED,
        self::STATUS_CANCELLED,
    ];

    // ── Priorités valides ──────────────────────────────────────────────────────
    const PRIORITY_CRITICAL = 'critical';
    const PRIORITY_HIGH     = 'high';
    const PRIORITY_NORMAL   = 'normal';
    const PRIORITY_LOW      = 'low';

    const PRIORITIES = [
        self::PRIORITY_CRITICAL,
        self::PRIORITY_HIGH,
        self::PRIORITY_NORMAL,
        self::PRIORITY_LOW,
    ];

    protected $fillable = [
        'reference',
        'customer_id',
        'site_id',
        'device_id',
        'assigned_to',
        'title',
        'reason',
        'description',
        'priority',
        'status',
        'desired_at',
        'resolved_at',
    ];

    protected $casts = [
        'desired_at'  => 'datetime',
        'resolved_at' => 'datetime',
    ];

    // ── Boot : génère la référence automatiquement ────────────────────────────
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (ServiceRequest $sr) {
            if (empty($sr->reference)) {
                $year  = now()->format('Y');
                $count = static::whereYear('created_at', $year)->count() + 1;
                $sr->reference = sprintf('SAV-%s-%04d', $year, $count);
            }
            if (empty($sr->status))   $sr->status   = self::STATUS_OPEN;
            if (empty($sr->priority)) $sr->priority = self::PRIORITY_NORMAL;
        });
    }

    // ── Relations ─────────────────────────────────────────────────────────────
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(ServiceRequestHistory::class)->latest();
    }

    // ── Scopes ────────────────────────────────────────────────────────────────
    public function scopeByStatus($query, ?string $status)
    {
        return $status ? $query->where('status', $status) : $query;
    }

    public function scopeByPriority($query, ?string $priority)
    {
        return $priority ? $query->where('priority', $priority) : $query;
    }

    public function scopeSearch($query, ?string $term)
    {
        if (!$term) return $query;
        return $query->where(function ($q) use ($term) {
            $q->where('title', 'like', "%{$term}%")
              ->orWhere('description', 'like', "%{$term}%")
              ->orWhere('reference', 'like', "%{$term}%")
              ->orWhere('reason', 'like', "%{$term}%");
        });
    }

    // ── Priorité en ordre trié (critical > high > normal > low) ──────────────
    public function scopeOrderByPriorityDesc($query)
    {
        return $query->orderByRaw("FIELD(priority, 'critical', 'high', 'normal', 'low')");
    }
}
