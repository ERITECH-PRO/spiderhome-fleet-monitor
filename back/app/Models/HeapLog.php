<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

/**
 * HeapLog — Adaptateur lecture seule vers la table `heap_logs`
 * gérée par le serveur Express (SpiderHome Fleet Monitor).
 *
 * ⚠️  READ-ONLY : aucune écriture autorisée via ce modèle.
 *      Toute tentative de save() / create() / update() lèvera une exception.
 *
 * Connexion : heap_monitoring (DB_HEAP_*)
 * Table     : heap_logs
 */
class HeapLog extends Model
{
    // ──────────────────────────────────────────────
    // Connexion dédiée (base SpiderHome Express)
    // ──────────────────────────────────────────────
    protected $connection = 'heap_monitoring';
    protected $table      = 'heap_logs';

    public function getConnectionName()
    {
        return app()->environment('testing') ? config('database.default') : $this->connection;
    }

    // La table utilise `timestamp` comme colonne principale,
    // pas les colonnes `created_at` / `updated_at` Laravel.
    public $timestamps = false;

    // ──────────────────────────────────────────────
    // Cast des colonnes
    // ──────────────────────────────────────────────
    protected $casts = [
        'id'             => 'integer',
        'timestamp'      => 'datetime',
        'created_at'     => 'datetime',
        'heap'           => 'float',
        'heap_kb'        => 'float',
        'heap_effective' => 'float',
        'max_block'      => 'float',
        'frag_pct'       => 'float',
        'uptime'         => 'integer',
        'maxblk'         => 'float',
        'frag'           => 'float',
    ];

    // Colonnes exposables (lecture seule)
    protected $visible = [
        'id', 'timestamp', 'device',
        'heap', 'heap_kb', 'heap_effective',
        'max_block', 'frag_pct',
        'uptime', 'event', 'level',
        'note', 'status', 'maxblk', 'frag',
        'created_at',
    ];

    // ──────────────────────────────────────────────
    // Protection en écriture
    // ──────────────────────────────────────────────
    protected $guarded = ['*'];

    /**
     * Lève une exception si quelqu'un tente d'écrire via ce modèle.
     */
    public static function boot(): void
    {
        parent::boot();

        $reject = fn() => throw new \LogicException(
            'HeapLog est en lecture seule — les écritures sont interdites.'
        );

        static::creating($reject);
        static::updating($reject);
        static::deleting($reject);
    }

    // ──────────────────────────────────────────────
    // Scopes de filtrage
    // ──────────────────────────────────────────────

    /** Filtre par identifiant de device (exact ou LIKE). */
    public function scopeForDevice(Builder $q, string $device): Builder
    {
        return $q->where('device', $device);
    }

    /** Logs des dernières N heures. */
    public function scopeLastHours(Builder $q, int $hours = 24): Builder
    {
        return $q->where('timestamp', '>=', now()->subHours($hours));
    }

    /** Filtre par niveau de statut. */
    public function scopeWithStatus(Builder $q, string $status): Builder
    {
        return $q->where(function (Builder $sub) use ($status) {
            $sub->where('status', $status)
                ->orWhere('level', $status);
        });
    }

    /** Scope: uniquement les entrées critiques. */
    public function scopeCritical(Builder $q): Builder
    {
        return $q->where(function (Builder $sub) {
            $sub->whereRaw("UPPER(COALESCE(status,'')) = 'CRITICAL'")
                ->orWhereRaw("UPPER(COALESCE(level,''))  = 'CRITICAL'");
        });
    }
}
