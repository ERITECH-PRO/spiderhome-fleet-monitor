<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Journal d'audit — cahier des charges §10 / REC-11.
 *
 * Immuable par construction : pas de $fillable au-delà des colonnes utiles
 * à l'écriture initiale, pas de route update/destroy exposée (voir
 * AuditLogController), et created_at n'est jamais modifié après coup.
 */
class AuditLog extends Model
{
    public $timestamps = false; // une seule date : created_at, posée à la création

    protected $fillable = [
        'user_id', 'action', 'auditable_type', 'auditable_id',
        'meta', 'ip_address', 'user_agent', 'created_at',
    ];

    protected $casts = [
        'meta'       => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Enregistre une entrée d'audit à partir de la requête HTTP courante.
     * N'échoue jamais l'action métier appelante si l'écriture du journal
     * elle-même échoue (log applicatif à la place).
     */
    public static function record(string $action, ?Model $subject = null, array $meta = []): void
    {
        try {
            $request = request();

            static::create([
                'user_id'         => $request?->user()?->id,
                'action'          => $action,
                'auditable_type'  => $subject ? get_class($subject) : null,
                'auditable_id'    => $subject?->getKey(),
                'meta'            => $meta,
                'ip_address'      => $request?->ip(),
                'user_agent'      => $request ? substr((string) $request->userAgent(), 0, 255) : null,
                'created_at'      => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
