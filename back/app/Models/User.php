<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    // ── Rôles — cahier des charges §4 « Utilisateurs et droits » ────────────
    public const ROLE_ADMIN      = 'admin';      // Configuration, utilisateurs, firmwares, campagnes, audit, référentiels
    public const ROLE_SUPPORT    = 'support';    // Clients, appareils, incidents, diagnostics, demandes d'intervention
    public const ROLE_TECHNICIAN = 'technician'; // Interventions assignées, diagnostic, compte rendu
    public const ROLE_QUALITY    = 'quality';    // Statistiques, versions, lots, incidents récurrents, rapports (lecture seule)
    public const ROLE_CLIENT     = 'client';     // Ses sites et modules uniquement, demandes SAV, notifications

    public const ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_SUPPORT,
        self::ROLE_TECHNICIAN,
        self::ROLE_QUALITY,
        self::ROLE_CLIENT,
    ];

    /** Rôles internes à l'entreprise (par opposition au compte client). */
    public const STAFF_ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_SUPPORT,
        self::ROLE_TECHNICIAN,
        self::ROLE_QUALITY,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'customer_id',
        'phone',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function isClient(): bool
    {
        return $this->role === self::ROLE_CLIENT;
    }

    public function isTechnician(): bool
    {
        return $this->role === self::ROLE_TECHNICIAN;
    }

    public function isStaff(): bool
    {
        return in_array($this->role, self::STAFF_ROLES, true);
    }

    public function hasTwoFactorEnabled(): bool
    {
        return ! is_null($this->two_factor_confirmed_at);
    }
}
